const { saveContactStateFactory } = require('./helpers')

module.exports = function (RED) {
    'use strict'

    function WhatsappStoreMessage(config) {
        RED.nodes.createNode(this, config)

        const node = this
        node.name = config.name
        const chave = config.chave.replace(' ', '_')

        const clientNode = RED.nodes.getNode(config.client)

        const saveContactState = saveContactStateFactory(clientNode)

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

                saveContactState(to.split('@')[0], msg.session)
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

                    saveContactState(to.split('@')[0], msg.session)

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
