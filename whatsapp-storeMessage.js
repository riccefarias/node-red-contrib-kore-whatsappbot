module.exports = function (RED) {
    'use strict'
    const { writeFileSync } = require('fs')

    function WhatsappStoreMessage(config) {
        RED.nodes.createNode(this, config)

        const node = this
        node.name = config.name
        const chave = config.chave.replace(' ', '_')

        const clientNode = RED.nodes.getNode(config.client)

        function saveState(id, data) {
            const sessionDir =
                clientNode.storage + '/contacts/' + id.split('@')[0] + '.json'

            if (data) {
                return writeFileSync(sessionDir, JSON.stringify(data))
            } else {
                return false
            }
        }

        if (clientNode) {
            console.log(clientNode)
        }

        node.on('input', function (msg) {
            const to = msg.to || msg.payload.contactId || node.to

            if (msg.executed) {
                if (!msg.session) {
                    msg.session = {}
                }

                msg.session['lastNodeId'] = node.id

                saveState(to.split('@')[0], msg.session)
            } else if (
                msg.session === false ||
                msg.session.lastNodeId === node.id
            ) {
                if (to && chave) {
                    if (!msg.session) {
                        msg.session = {}
                    }

                    msg.executed = true
                    msg.session['lastNodeId'] = node.id
                    msg.session['user.' + chave] = msg.payload.text

                    saveState(to.split('@')[0], msg.session)

                    node.send(msg)
                } else {
                    node.error('"to" and "chave" are required parameters')
                }
            } else {
                node.send(msg)
            }
        })
    }

    RED.nodes.registerType('whatsapp-storemessage', WhatsappStoreMessage)
}
