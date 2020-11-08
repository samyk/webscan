/*
 * reliable web-based network scanner
 * by samy kamkar 2020/11/07
 * https://samy.pl
 */

(function(window) {
// subnets to scan for
let subnets = [
  '10.0.0.1',
  '10.0.0.138',
  '10.0.0.2',
  '10.0.1.1',
  '10.1.1.1',
  '10.1.10.1',
  '10.10.1.1',
  '10.90.90.90',
  '192.168.*.1',
  '192.168.0.10',
  '192.168.0.100',
  '192.168.0.101',
  '192.168.0.227',
  '192.168.0.254',
  '192.168.0.3',
  '192.168.0.30',
  '192.168.0.50',
  '192.168.1.10',
  '192.168.1.100',
  '192.168.1.20',
  '192.168.1.200',
  '192.168.1.210',
  '192.168.1.254',
  '192.168.1.99',
  '192.168.10.10',
  '192.168.10.100',
  '192.168.10.50',
  '192.168.100.100',
  '192.168.123.254',
  '192.168.168.168',
  '192.168.2.254',
  '192.168.223.100',
  '192.168.254.254',
  //'200.200.200.5',
]

function dump(obj, indent)
{
  let result = ""
  if (indent == null) indent = ""

  for (let property in obj)
  {
    let value = obj[property]
    if (typeof value == 'string')
      value = "'" + value + "'"
    else if (typeof value == 'object')
    {
      if (value instanceof Array)
      {
        // Just let JS convert the Array to a string!
        value = "[ " + value + " ]"
      }
      else
      {
        // Recursive dump
        // (replace "  " by "\t" or something else if you prefer)
        let od = dump(value, indent + "  ")
        // If you like { on the same line as the key
        //value = "{\n" + od + "\n" + indent + "}"
        // If you prefer { and } to be aligned
        value = "\n" + indent + "{\n" + od + "\n" + indent + "}"
      }
    }
    result += indent + "'" + property + "' : " + value + ",\n"
  }
  return result.replace(/,\n$/, "")
}

// ascii to hex
function a2h(str)
{
  let hex = []
  for (let n = 0; n < str.length; n++)
  {
    let hbyte = Number(str.charCodeAt(n)).toString(16)
    if (hbyte.length == 1)
      hbyte = "0" + hbyte
    hex.push(hbyte)
  }
  return hex.join('')
}

// Connect the two peers. Normally you look for and connect to a remote
// machine here, but we're just connecting two local objects, so we can
// bypass that step.
window.connectPeers = async function(ip, success)
{
  let localConnection = null // RTCPeerConnection for our "local" connection
  let remoteConnection = null  // RTCPeerConnection for the "remote"

  let sendChannel = null // RTCDataChannel for the local (sender)
  let receiveChannel = null    // RTCDataChannel for the remote (receiver)

  // Handles clicks on the "Send" button by transmitting
  // a message to the remote peer.
  function sendMessage()
  {
    sendChannel.send('test')
  }

  // Handle status changes on the local end of the data
  // channel this is the end doing the sending of data
  // in this example.
  function handleSendChannelStatusChange(event)
  {
    console.log('handleSendChannelStatusChange', sendChannel)
    if (sendChannel)
    {
      console.log('sendChannel state: ' + sendChannel.readyState)
      if (sendChannel.readyState === 'open')
        sendMessage()
    }
  }

  // Called when the connection opens and the data
  // channel is ready to be connected to the remote.
  function receiveChannelCallback(event)
  {
    console.log(`receiveChannelCallback: ${event}`, event)
    //document.getElementById('content').innerHTML += '<b>XXXreceiveChannelCallback:</b>'+dump(event, '  ')
    receiveChannel = event.channel
    receiveChannel.onmessage = handleReceiveMessage
    receiveChannel.onopen = handleReceiveChannelStatusChange
    receiveChannel.onclose = handleReceiveChannelStatusChange
  }


  // Handle status changes on the receiver's channel.
  function handleReceiveChannelStatusChange(event)
  {
    console.log(`handleReceiveChannelStatusChange`)
    if (receiveChannel)
      console.log("Receive channel's status has changed to " + receiveChannel.readyState)
  }

  // Close the connection, including data channels if they're open
  // Also update the UI to reflect the disconnected status
  function disconnectPeers()
  {
    console.log(`disconnectPeers`)
    // Close the RTCDataChannels if they're open
    sendChannel.close()
    receiveChannel.close()

    // Close the RTCPeerConnections
    localConnection.close()
    remoteConnection.close()

    sendChannel = null
    receiveChannel = null
    localConnection = null
    remoteConnection = null
  }

  // Create the local connection and its event listeners
  const config = {
    iceServers: [],
    iceTransportPolicy: 'all',
    iceCandidatePoolSize: 0,
  }
  localConnection = new RTCPeerConnection(config)

  // Create the data channel and establish its event listeners
  sendChannel = localConnection.createDataChannel("sendChannel")
  sendChannel.onopen = async function(e) { success(ip) }
  //sendChannel.onopen = handleSendChannelStatusChange
  sendChannel.onclose = handleSendChannelStatusChange

  // Create the remote connection and its event listeners
  remoteConnection = new RTCPeerConnection()
  remoteConnection.ondatachannel = receiveChannelCallback

  // Set up the ICE candidates for the two peers
  localConnection.onicecandidate = function(e)
  {
    if (e.candidate)
    {
      let newcan = {}
      for (let key of ["address", "candidate", "component", "foundation", "port", "priority", "protocol", "relatedAddress", "relatedPort", "sdpMLineIndex", "sdpMid", "tcpType", "type", "usernameFragment"])
        newcan[key] = e.candidate[key]
      newcan.candidate = newcan.candidate.replaceAll(/[\w\-]+\.local|127\.0\.0\.1/g, ip)
      newcan.address = ip
      return localConnection.addIceCandidate(newcan)
    }
    return !e.candidate || remoteConnection.addIceCandidate(e.candidate)
  }

  remoteConnection.onicecandidate = function(e)
  {
    if (e.candidate)
    {
      let newcan = {}
      for (let key of ["address", "candidate", "component", "foundation", "port", "priority", "protocol", "relatedAddress", "relatedPort", "sdpMLineIndex", "sdpMid", "tcpType", "type", "usernameFragment"])
        newcan[key] = e.candidate[key]
      newcan.candidate = newcan.candidate.replaceAll(/[\w\-]+\.local|127\.0\.0\.1/g, ip)
      newcan.address = ip
      return localConnection.addIceCandidate(newcan)
    }
    return !e.candidate || localConnection.addIceCandidate(e.candidate)
  }

  // Now create an offer to connect this starts the process
  localConnection.createOffer()
  .then(offer => localConnection.setLocalDescription(offer))
  .then(() => remoteConnection.setRemoteDescription(localConnection.localDescription))
  .then(() => remoteConnection.createAnswer())
  .then(answer => remoteConnection.setLocalDescription(answer))
  .then(() => localConnection.setRemoteDescription(remoteConnection.localDescription))
  .catch(handleCreateDescriptionError)
}

// Handle errors attempting to create a description
// this can happen both when creating an offer and when
// creating an answer. In this simple example, we handle
// both the same way.
function handleCreateDescriptionError(error)
{
  console.log("Unable to create an offer: " + error.toString())
}

// Handle successful addition of the ICE candidate
// on the "local" end of the connection.
function handleLocalAddCandidateSuccess()
{
  console.log('handleLocalAddCandidateSuccess')
}

// Handle successful addition of the ICE candidate
// on the "remote" end of the connection.
function handleRemoteAddCandidateSuccess()
{
  console.log('handleRemoteAddCandidateSuccess')
}

// Handle an error that occurs during addition of ICE candidate.

function handleAddCandidateError()
{
  console.log(`handleAddCandidateError - FAIL`)
}

// Handle onmessage events for the receiving channel.
// These are the data messages sent by the sending channel.

function handleReceiveMessage(event)
{
  console.log(`handleReceiveMessage: ${event}: ${event.data}`)
  //document.getElementById('content').innerHTML += '\n<b>XXXhandleReceiveMessage:</b>'+dump(event, '  ')
  console.log(event.ice)
}

// convert * in ips to 0..255
let unroll_ips = function(ips, min, max)
{
  // convert single ip to array
  if (typeof(ips) === 'string')
    ips = [ips]

  // flatten *
  return ips.flatMap(ip =>
    ip.indexOf('*') != -1 ?
    [...Array((max-(min||0)||256)-(min||0)).keys()].map(i => ip.replace('*', (min || 0) + i)) :
    ip
  )
}

// hit blocks of ips, timeout after ms
window.scanIps = async function(ips, conf)
{
  if (!conf) conf = { }
  if (!conf.block) conf.block = 50
  if (conf.logger) conf.logger(`scanIps() started`)

  let liveIps = {}
  // scan blocks of IPs
  for (let i = 0; i < ips.length; i += conf.block)
    liveIps = Object.assign(liveIps, await scanIpsBlock(ips.slice(i, i+conf.block), conf))

  return liveIps
}

window.scanIpsBlock = async function(ips, conf)
{
  // ensure we're on http
  if (window.location.protocol !== 'http:')
    window.location.protocol = 'http:'

  if (!conf) conf = { }
  if (!conf.timeout) conf.timeout = 1500
  if (conf.logger) conf.logger(`scanIpsBlock(${ips})`)
  let promises = {}
  let liveIps = {}
  let scans = []
  const controller = new AbortController()
  const { signal } = controller

  // add ip to our live IPs
  let addLive = async function(ip, time)
  {
    liveIps[ip] = time

    // now validate which ips are actually local via webrtc
    if (conf.rtc !== false)
      await connectPeers(ip, function(ip)
      {
        if (conf.logger) conf.logger(`<b>found LOCAL ip address: ${ip}</b>`)
        liveIps[ip] = 0
      })
  }

  // generate success/fail promises first to speed things up
  for (let ip of ips)
    promises[ip] = (function(ip) {
      return function(e)
      {
        // if we didn't abort, this ip is live!
        if (e.name !== 'AbortError')
          addLive(ip, new Date().getTime())
      }
    })(ip)

  // stop all fetches after timeout
  setTimeout(function()
  {
    controller.abort()
  }, conf.timeout)

  // scan our ips
  let start = {}
  for (let ip of ips)
  {
    scans.push(fetch(`http://${ip}:1337/samyscan`, { signal }).catch(promises[ip]))
    start[ip] = new Date().getTime()
  }
      //scans.push(fetch(`http://${ip}:1337/samyscan`, { signal }).then(promises[ip]).catch(promises[ip]))

  // when everything's done scanning, get time in ms
  await Promise.all(scans.map(p => p.catch(e => e))).then(v => {
    for (let [ip, end] of Object.entries(liveIps))
      if (liveIps[ip])
        liveIps[ip] -= start[ip]
  })
  //if (conf.logger) conf.logger('scanIpsBlock done')

  // return ip: time
  return liveIps
}

// return subnet from ip address
function getSubnet(ip)
{
  return ip.substr(0, ip.indexOf('.', ip.indexOf('.', ip.indexOf('.')+1)+1)+1)
}

// scan for subnets, then scan discovered subnets for IPs
window.webScanAll = async function(nets, conf)
{
  let possible = {}
  let ips = {}
  if (!conf) conf = { }
  if (!nets) nets = subnets
  if (conf.logger) conf.logger(`webScanAll() started`)

  // first get our possible networks
  nets = await scanIps(unroll_ips(nets), conf)

  // now let's scan each block of 256 IPs per net
  for (let net of Object.keys(nets))
  {
    if (conf.logger) conf.logger(`scanIps(${getSubnet(net)})`)
    Object.assign(possible, await scanIps(unroll_ips(getSubnet(net)+'*', 2, 253), conf))
  }

  ips.network = possible
  ips.local = Object.keys(possible).filter(ip => possible[ip] === 0)
  return ips
}
})(window)


