module.exports = function (RED) {
    'use strict'
    const { unlinkSync, existsSync, mkdirSync } = require('fs')
    const makeWASocket = require('@adiwajshing/baileys')
    const { useSingleFileAuthState } = makeWASocket
    const QR = require('qrcode-base64')
    const P = require('pino')

    // Imports the Google Cloud client library
    const textToSpeech = require('@google-cloud/text-to-speech')
    const ttsclient = new textToSpeech.TextToSpeechClient()

    let client

    function WhatsappClient(config) {
        RED.nodes.createNode(this, config)
        const node = this

        const DIR = config.storage || '/data/whatsapp/' + config.session
        if (!existsSync(DIR + '/contacts')) {
            mkdirSync(DIR + '/contacts', { recursive: true })
        }

        node.storage = DIR
        node.storeMessages = []

        let { state, saveState } = useSingleFileAuthState(DIR + '/session.json')

        function connectWA() {
            const sock = makeWASocket.default({
                browser: [config.agent, 'Google Chrome', '18.04'],
                logger: P({ level: 'debug' }),
                printQRInTerminal: true,
                auth: state,
                version: config.version.split(','),
            })
            sock.ev.on('messages.upsert', async (m) => {
                //console.log('upsert',m);
                m.messages.forEach(async (message) => {
                    parseMessage(message)
                })
            })
            sock.ev.on('messages.update', (m) => {
                m.forEach((message) => {
                    console.log('status', message)

                    const stored = node.storeMessages.find(
                        (f) => message.key.id === f.key.id
                    )

                    if (stored) {
                        const toNode = RED.nodes.getNode(stored.nodeId)
                        if (toNode) {
                            toNode.emit('messageStatus', message)
                        }
                    }
                })
            })
            sock.ev.on('presence.update', (m) =>
                console.log('presence.update', m)
            )
            sock.ev.on('chats.update', (m) => console.log('chats.update', m))
            sock.ev.on('contacts.update', (m) =>
                console.log('contacts.update', m)
            )

            sock.ev.on('connection.update', (update) => {
                const { connection, lastDisconnect } = update
                if (connection === 'close') {
                    // reconnect if not logged out

                    if (
                        lastDisconnect &&
                        lastDisconnect.error &&
                        lastDisconnect.error.output &&
                        (lastDisconnect.error.output.statusCode === 410 ||
                            lastDisconnect.error.output.statusCode === 428 ||
                            lastDisconnect.error.output.statusCode === 515)
                    ) {
                        client = connectWA()
                    } else {
                        if (
                            lastDisconnect &&
                            lastDisconnect.error &&
                            lastDisconnect.error.output &&
                            lastDisconnect.error.output.statusCode === 401
                        ) {
                            unlinkSync(DIR + '/session.json')

                            setTimeout(() => {
                                const tmp = useSingleFileAuthState(
                                    DIR + '/session.json'
                                )
                                state = tmp.state
                                saveState = tmp.saveState

                                client = connectWA()
                            }, 2000)
                        } else {
                            console.log('Error unexpected', update)
                        }
                    }

                    /*
                            if((lastDisconnect.error as Boom).output.statusCode !== ) {

                            } else {
                                console.log('connection closed')
                            }*/
                }
                if (update.qr) {
                    onQrCode(update.qr)
                }
                if (connection === 'open') {
                    const iconSuccess = `data:image/png;base64,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`
                    node.emit('qrCode', iconSuccess)
                }

                node.emit('stateChange', update)
            })

            // listen for when the auth credentials is updated
            sock.ev.on('creds.update', saveState)

            return sock
        }

        client = connectWA()

        function onQrCode(qrCode) {
            node.emit(
                'qrCode',
                QR.drawImg(qrCode, {
                    typeNumber: 4,
                    errorCorrectLevel: 'M',
                    size: 500,
                })
            )
        }

        function parseMessage(message) {
            if (!message.message) {
                return
            }

            let tmp = {
                time: parseInt(message.messageTimestamp.toString()),
                messageId: message.key.id,
                contactId: message.key.remoteJid,
                fromMe: message.key.fromMe,
                isGroup: message.key.remoteJid.toString().match('@g.us')
                    ? true
                    : false,
                participant: message.key.remoteJid.toString().match('@g.us')
                    ? message.key.participant
                    : message.key.remoteJid,
                text: '',
            }

            const messageTypes = Object.keys(message.message)

            const messageType = messageTypes.find((t) =>
                [
                    'conversation',
                    'extendedTextMessage',
                    'buttonsResponseMessage',
                ].includes(t)
            )

            console.log('parsed message type', messageType, message.message)

            if (messageType === 'conversation') {
                tmp.text = message.message.conversation

                node.emit('message', tmp)
            } else if (messageType === 'extendedTextMessage') {
                tmp.text = message.message.extendedTextMessage.text

                node.emit('message', tmp)
            } else if (messageType === 'buttonsResponseMessage') {
                tmp.text =
                    message.message.buttonsResponseMessage.selectedDisplayText
                const btn =
                    message.message.buttonsResponseMessage.selectedButtonId.split(
                        '_'
                    )

                tmp.nodeBtn = btn[0]
                tmp.clickBtn = btn[1]

                node.emit('buttonResponseMessage', tmp)
            } else {
                console.log('UNKNOW TYPEOF: ' + typeof message.message)
            }

            return tmp
        }

        node.sendPresence = function (to, presence) {
            client.sendPresenceUpdate(presence, to)
        }

        node.sendRead = function (to, participant, key) {
            //client.sendReadReceipt(to, participant, [key])
        }

        node.sendTTS = async function (to, message) {
            // Construct the request
            const request = {
                input: { text: message },
                // Select the language and SSML voice gender (optional)
                voice: { languageCode: 'pt-BR', ssmlGender: 'MALE' },
                // select the type of audio encoding
                audioConfig: { audioEncoding: 'MP3' },
            }

            // Performs the text-to-speech request
            const [response] = await ttsclient.synthesizeSpeech(request)

            // send an audio file
            await client.sendMessage(to, {
                ptt: true,
                audio: response.audioContent,
                mimetype: 'audio/mp4',
            })
        }

        node.sendmessage = function (to, message, nodeId = false) {
            client.sendMessage(to, { text: message }).then((r) => {
                if (nodeId) {
                    r.nodeId = nodeId

                    node.storeMessages.push(r)
                }
                //console.log("RESP: ",r);
            })
        }

        node.sendimage = function (to, message, url, nodeId = false) {
            client
                .sendMessage(to, { image: { url: url, caption: message } })
                .then((r) => {
                    if (nodeId) {
                        r.nodeId = nodeId

                        node.storeMessages.push(r)
                    }
                    //console.log("RESP: ",r);
                })
        }

        node.sendButtons = function (to, params, nodeId = false) {
            client.sendMessage(to, params).then((r) => {
                if (nodeId) {
                    r.nodeId = nodeId

                    node.storeMessages.push(r)
                }
                //console.log("RESP: ",r);
            })
        }

        node.sendlocation = function (to, latitude, longitude, message) {
            client
                .sendMessage(to, {
                    location: {
                        degreesLatitude: latitude,
                        degreesLongitude: longitude,
                    },
                })
                .then((r) => {
                    console.log('RESP: ', r)
                })
        }

        node.sendcard = function (to, displayName, cards) {
            client
                .sendMessage(to, {
                    contacts: {
                        displayName: displayName,
                        contacts: [{ vcard: cards }],
                    },
                })
                .then((r) => {
                    console.log(r)
                })
        }

        node.addTag = function (jid, label) {
            let patch = {
                timestamp: Date.now(),
                syncAction: {
                    timestamp: Date.now(),
                    labelAssociationAction: {
                        labeled: true,
                    },
                },
                index: ['label_jid', label, jid],
                type: 'regular_high',
                apiVersion: 3,
                operation: 0,
            }

            client.appPatch(patch)
        }

        node.register = function (nodeToRegister) {}

        node.disconnect = function () {
            client.end()
        }

        node.reconnect = function () {
            client.end()
            setTimeout(() => {
                client = connectWA()
            }, 5000)
        }

        node.logout = function () {
            client.logout()
        }

        node.on('close', () => {
            client.end()
        })

        node.restart = async function () {
            if (client) {
                node.log('Restarting client ' + config.session)
            }
        }
    }

    RED.nodes.registerType('whatsapp-kore-client', WhatsappClient)
}
