const { saveContactStateFactory } = require('./helpers')

module.exports = function (RED) {
    'use strict'
   
    function WhatsappEndChat(config) {
        RED.nodes.createNode(this, config)

        const node = this

        const clientNode = RED.nodes.getNode(config.client)

        const saveContactState = saveContactStateFactory(clientNode)

        if (clientNode) {
            console.log(clientNode)
        }

        node.on('input', function (msg) {
            const to = msg.to || msg.payload.contactId || node.to
            if (!msg.session) {
                msg.session = {}
            } else {
                delete msg.session['lastNodeId']
            }
            saveContactState(to.split('@')[0], msg.session)
        })
    }

    RED.nodes.registerType('whatsapp-endchat', WhatsappEndChat)
}
