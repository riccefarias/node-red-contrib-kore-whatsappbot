module.exports = function (RED) {
    'use strict'
    const { writeFileSync } = require('fs')

    function WhatsappSendButtons(config) {
        RED.nodes.createNode(this, config)

        const node = this
        node.name = config.name
        node.force = config.force
        node.message = config.template
        node.buttons = config.rules

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
            const to = msg.to || msg.payload.contactId
            let message = msg.message || node.message

            if (msg.executed) {
                if (!msg.session) {
                    msg.session = {}
                }

                msg.session['lastNodeId'] = node.id

                saveState(to.split('@')[0], msg.session)
            }

            if (msg.topic === 'buttonResponseMessage') {
                let _resp = [null]
                node.buttons.forEach((b, k) => {
                    if (parseInt(k) === parseInt(msg.payload.clickBtn)) {
                        _resp.push(msg)
                    } else {
                        _resp.push(null)
                    }
                })

                node.send(_resp)
            } else if (
                node.force ||
                (msg.session === false && !msg.executed) ||
                (msg.session.lastNodeId === node.id && !msg.executed)
            ) {
                if (to) {
                    let params = {}

                    if (!msg.session) {
                        msg.session = {}
                    }

                    msg.executed = true

                    Object.keys(msg.session).forEach((p) => {
                        const kk = p.split('user.')

                        if (kk.length === 2) {
                            message = message.replace(
                                '{{' + kk[1] + '}}',
                                msg.session[p]
                            )
                        }
                    })

                    //{ text: params.text, buttons: buttons }
                    //{ buttonId: b.id, buttonText: { displayText: b.text }, type: b.type }
                    if (message) {
                        params['text'] = message
                    }

                    params['buttons'] = []
                    node.buttons.forEach((r, k) => {
                        params['buttons'].push({
                            buttonId: node.id + '_' + k,
                            buttonText: { displayText: r.t },
                            type: 1,
                        })
                    })

                    clientNode.sendButtons(to, params)

                    node.send(msg)
                } else {
                    node.error('"to" and "message" are required parameters')
                }
            } else {
                node.send(msg)
            }
        })
    }

    RED.nodes.registerType('whatsapp-sendbuttons', WhatsappSendButtons)
}
