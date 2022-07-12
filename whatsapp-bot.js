module.exports = function (RED) {
    'use strict'

    const { existsSync, readFileSync } = require("fs");

    function WhatsappBot(config) {
        RED.nodes.createNode(this, config)


        const node = this
        node.name = config.name;
        node.width = 160;

        const clientNode = RED.nodes.getNode(config.client)


        function loadContactSession(id) {
            const sessionDir = clientNode.storage + "/contacts/" + id.split("@")[0] + ".json";

            if (existsSync(sessionDir)) {
                return JSON.parse(readFileSync(sessionDir).toString());
            } else {
                return false;
            }
        }


        function sendImageToClient(image, msg) {
            var d = { id: node.id }
            if (image !== null) {
                if (Buffer.isBuffer(image)) {
                    image = image.toString("base64");
                }
                d.data = image;
            }
            try {
                RED.comms.publish("image", d);
                if (msg) { node.status({ text: msg }); }
            }
            catch (e) {
                node.error("Invalid image", msg);
            }
        }




        function registerEvents() {
            clientNode.on('stateChange', onStateChange.bind(node))
            // clientNode.on('clientEvent', onClientEvent.bind(node))
        }


        function onStateChange(socketState) {



            if (socketState.connection) {
                setStatus(socketState.connection, socketState.connection);

                node.send({ topic: 'stateChange', payload: socketState })
            }
            if (socketState.qr) {

                setStatus('authenticate', 'waiting for qrcode scanning');
            }

            //setStatus(SOCKETS_STATE[socketState], 'Socket: ' + socketState)
        }



        function onChatEvent(event, chatId, ...args) {
            node.send({ topic: event, chatId: chatId, args: args })
        }

        if (clientNode) {
            clientNode.register(node)


            setStatus('warning', 'Authenticating...')

            clientNode.on('qrCode', function (qrCode) {


                const base64 = qrCode.replace(/^data:image\/[a-z]+;base64,/, "");
                sendImageToClient(base64, 'Scan QrCode');


                node.send([
                    { topic: 'qrCode', payload: qrCode }
                    , null])
            })
            clientNode.on('message', function (payload) {

                if (payload.fromMe) {
                    return;
                }

                let outNode = node;

                const contactSession = loadContactSession(payload.contactId);
                if (contactSession.lastNodeId) {
                    const lastNode = RED.nodes.getNode(contactSession.lastNodeId);

                    if (lastNode) {
                        lastNode.emit("input", {
                            topic: 'textMessage',
                            clientId: clientNode.id,
                            originId: node.id,
                            session: contactSession,
                            executed: false,
                            payload: payload
                        })

                        return;
                    }
                }

                outNode.send([null, {
                    topic: 'textMessage',
                    clientId: clientNode.id,
                    originId: node.id,
                    session: contactSession,
                    executeNext: false,
                    payload: payload
                }]);
            })


            clientNode.on('buttonResponseMessage', function (payload) {

                if (payload.fromMe) {
                    return;
                }

                let outNode = node;

                const contactSession = loadContactSession(payload.contactId);
                const lastNode = RED.nodes.getNode(payload.nodeBtn);

                if (lastNode) {
                    lastNode.emit("input", {
                        topic: 'buttonResponseMessage',
                        clientId: clientNode.id,
                        originId: node.id,
                        session: contactSession,
                        executed: false,
                        payload: payload
                    })

                    return;
                }


                outNode.send([null, {
                    topic: 'textMessage',
                    clientId: clientNode.id,
                    originId: node.id,
                    session: contactSession,
                    executeNext: false,
                    payload: payload
                }]);
            })

            clientNode.on('ready', function (client) {
                setStatus('success', 'Connected')

                node.client = client
            })

            registerEvents()
        }

        node.on('input', function (msg) {
            if (msg.topic == 'disconnect') {
                clientNode.disconnect();
            } else if (msg.topic === 'reconnect') {

                clientNode.reconnect();
            } else if (msg.topic === 'logout') {

                clientNode.logout();
            }

        })

        // Set node status
        function setStatus(type, message) {
            const types = { info: 'blue', error: 'red', warning: 'yellow', success: 'green' }

            node.status({
                fill: types[type] || 'grey',
                shape: 'dot',
                text: message
            })
        }
    }

    RED.nodes.registerType('whatsapp-kore-bot', WhatsappBot)
}