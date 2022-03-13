module.exports = function (RED) {
    'use strict'
    const { readFileSync, writeFileSync,unlinkSync } = require("fs");
    const makeWASocket = require('@adiwajshing/baileys-md');
    const { WASocket, useSingleFileAuthState } = makeWASocket;
    const QR = require("qrcode-base64");
    const P = require("pino")

    // Imports the Google Cloud client library
    const textToSpeech = require('@google-cloud/text-to-speech');
    const ttsclient = new textToSpeech.TextToSpeechClient();

    const noop = () => {}


    let client;

    function WhatsappClient (config) {
        RED.nodes.createNode(this, config)
        const node = this ;

        node.storeMessages = [];


        let { state, saveState } = useSingleFileAuthState('/data/auth.'+config.session+'.json')


        function connectWA(){
            const sock = makeWASocket.default({
                browser: [config.agent, 'Google Chrome', '18.04'],
                logger: P({ level: 'debug' }),
                printQRInTerminal: true,
                auth: state,
		version: [2,2204,13]
            })
            sock.ev.on('messages.upsert', async m => {

                //console.log('upsert',m);
                m.messages.forEach(async (message)=>{
                    parseMessage(message)
                });
            })
            sock.ev.on('messages.update', m => {

                m.forEach((message)=>{

                    console.log("status",message);

                    const stored = node.storeMessages.find((f)=> message.key.id === f.key.id);

                    if(stored){
                        const toNode = RED.nodes.getNode(stored.nodeId);
                        if(toNode){
                            toNode.emit("messageStatus",message);
                        }
                    }


                });

            })
            sock.ev.on('presence.update', m => console.log('presence.update',m))
            sock.ev.on('chats.update', m => console.log('chats.update',m))
            sock.ev.on('contacts.update', m => console.log('contacts.update',m))



            sock.ev.on('connection.update', (update) => {
                const { connection, lastDisconnect } = update
                if(connection === 'close') {
                    // reconnect if not logged out

                    if(lastDisconnect && lastDisconnect.error && lastDisconnect.error.output && (lastDisconnect.error.output.statusCode===410 || lastDisconnect.error.output.statusCode===428)){
                        client = connectWA();
                    }else if(lastDisconnect && lastDisconnect.error && lastDisconnect.error.output && (lastDisconnect.error.output.statusCode===401)){
                        unlinkSync('/data/auth.'+config.session+'.json');

                        setTimeout(()=>{
                            const tmp = useSingleFileAuthState('/data/auth.'+config.session+'.json');
                            state = tmp.state;
                            saveState = tmp.saveState;

                            client = connectWA();
                        },2000);
                    }

                    /*
                            if((lastDisconnect.error as Boom).output.statusCode !== ) {

                            } else {
                                console.log('connection closed')
                            }*/
                }
                if(update.qr){
                    onQrCode(update.qr);
                }

                node.emit('stateChange',update);
            })


            // listen for when the auth credentials is updated
            sock.ev.on('creds.update', saveState)

            return sock;
        }


        client = connectWA();


        function onQrCode (qrCode) {
            node.emit('qrCode', QR.drawImg(qrCode, {
                typeNumber: 4,
                errorCorrectLevel: 'M',
                size: 500
            }))
        }

        function parseMessage(message){
            if(!message.message){
                return ;
            }

            let tmp = {
                time: parseInt(message.messageTimestamp.toString()),
                messageId: message.key.id,
                contactId: message.key.remoteJid,
                fromMe: message.key.fromMe,
                isGroup: (message.key.remoteJid.toString().match("@g.us"))?true:false,
                participant: (message.key.remoteJid.toString().match("@g.us"))?message.key.participant:message.key.remoteJid,
                text: ''
            };


            const messageTypes = Object.keys (message.message);

            const messageType = messageTypes.find((t)=> ['conversation','extendedTextMessage','buttonsResponseMessage'].includes(t));

            console.log("parsed message type",messageType,message.message);

            if(messageType==="conversation"){
                tmp.text = message.message.conversation;

                node.emit("message",tmp);
            }else if(messageType==="extendedTextMessage"){
                tmp.text = message.message.extendedTextMessage.text;

                node.emit("message",tmp);
            }else if(messageType==='buttonsResponseMessage'){
                tmp.text = message.message.buttonsResponseMessage.selectedDisplayText;
                const btn = message.message.buttonsResponseMessage.selectedButtonId.split("_");

                tmp.nodeBtn = btn[0];
                tmp.clickBtn = btn[1];


                node.emit("buttonResponseMessage",tmp);

            }else{
                console.log("UNKNOW TYPEOF: "+(typeof message.message))
            }


            return tmp;
        }


        node.sendPresence = function(to,presence){
            client.sendPresenceUpdate(presence,to);
        }

        node.sendRead = function(to,participant,key){
            client.sendReadReceipt(to, participant, [key])
        }

        node.sendTTS = async function(to,message){
            // Construct the request
            const request = {
                input: {text: message},
                // Select the language and SSML voice gender (optional)
                voice: {languageCode: 'pt-BR', ssmlGender: 'MALE'},
                // select the type of audio encoding
                audioConfig: {audioEncoding: 'MP3'},
            };

            // Performs the text-to-speech request
            const [response] = await ttsclient.synthesizeSpeech(request);

            // send an audio file
            await client.sendMessage(
                to,
                {  ptt: true,audio: response.audioContent, mimetype: 'audio/mp4' })
        }

        node.sendmessage = function(to,message,nodeId = false){

            client.sendMessage(to,{text: message}).then((r)=>{
                if(nodeId){

                    r.nodeId = nodeId;

                    node.storeMessages.push(r);
                }
                //console.log("RESP: ",r);
            });
        }

        node.sendButtons = function(to,params,nodeId=false){
            client.sendMessage(to,params).then((r)=>{
                if(nodeId){
                    
                    r.nodeId = nodeId;

                    node.storeMessages.push(r);
                }
                //console.log("RESP: ",r);
            });
        }


        node.sendlocation = function(to,latitude,longitude,message){
            client.sendMessage(to,{location: { degreesLatitude: latitude, degreesLongitude: longitude } }).then((r)=>{
                console.log("RESP: ",r);
            });
        }

        node.sendcard = function(to,displayName,cards){
            client.sendMessage(to,{contacts:{displayName: displayName,contacts: [{vcard: cards}]}}).then((r)=>{
                console.log(r);
            });
        }


        node.register = function (nodeToRegister) {

        }

        node.disconnect = function(){
            client.end();
        }

        node.reconnect = function(){
            client.end();
            setTimeout(()=>{
                client = connectWA();
            },5000);
        }

        node.logout = function(){
            client.logout();
        }




        node.on('close',()=>{
            client.end();
        });


        node.restart = async function () {
            if (client) {
                node.log('Restarting client ' + config.session)
            }
        }
    }

    RED.nodes.registerType('whatsapp-kore-client', WhatsappClient)
}