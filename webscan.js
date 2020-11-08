/*
 * cross-browser/cross-platform browser-based network scanner and local ip detector
 * by samy kamkar 2020/11/07
 * https://samy.pl
 */

(function(window) {

// scanned ips
let scanned = {}

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
  '192.168.100.1',
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

let candidateKeys = ["address", "candidate", "component", "foundation", "port", "priority", "protocol", "relatedAddress", "relatedPort", "sdpMLineIndex", "sdpMid", "tcpType", "type", "usernameFragment"]

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
    if (sendChannel)
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
    if (sendChannel) sendChannel.close()
    if (receiveChannel) receiveChannel.close()

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
    iceCandidatePoolSize: 0
  }
  localConnection = new RTCPeerConnection(config)

  // Create the data channel and establish its event listeners
  // XXX is there an alternative of this for older browsers that doesn't require mic?
  if (localConnection.createDataChannel)
  {
    sendChannel = localConnection.createDataChannel("sendChannel")
    sendChannel.onopen = async function(e) { success(ip) }
    //sendChannel.onopen = handleSendChannelStatusChange
    sendChannel.onclose = handleSendChannelStatusChange
  }

  // Create the remote connection and its event listeners
  remoteConnection = new RTCPeerConnection(config)
  remoteConnection.ondatachannel = receiveChannelCallback

  // generate onicecandidate function for local and remote connections
  let iceCan = function(con) {
    return function(e)
    {
      let ret = 0
      try
      {
        if (e.candidate)
        {
          let newcan = {}
          for (let key of candidateKeys)
            newcan[key] = e.candidate[key]
          newcan.candidate = newcan.candidate.replaceAll(/[\w\-]+\.local|127\.0\.0\.1/g, ip)
          newcan.address = ip
          console.log('newcan', newcan)
          console.log(con)
          ret = con.addIceCandidate(newcan)
          return ret
        }
        ret = !e.candidate || con.addIceCandidate(e.candidate)
      } catch(e) { console.log('err', e) }
      return ret
    }
  }

  // Set up the ICE candidates for the two peers
  localConnection.onicecandidate = iceCan(remoteConnection)
  remoteConnection.onicecandidate = iceCan(localConnection)

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
  console.log(event.ice)
}

// convert * in ips to 0..255
window.unroll_ips = function(ips, min, max)
{
  let newips = []
  // convert single ip to array
  if (typeof(ips) === 'string')
    ips = [ips]

  // flatten * (older Edge doesn't support flatMap)
  for (let ip of ips)
    newips = newips.concat(
      ip.indexOf('*') != -1 ?
      [...Array((max-(min||0)||256)-(min||0)).keys()].map(i => ip.replace('*', (min || 0) + i)) :
      ip
    )
  return newips
}

// hit blocks of ips, timeout after ms
window.scanIps = async function(ips, conf, subnet)
{
  if (!conf) conf = { }
  if (!conf.block) conf.block = 30
  if (conf.logger) conf.logger(`scanIps() started, subnet=${!!subnet}`)

  let liveIps = {}
  // scan blocks of IPs
  for (let i = 0; i < ips.length; i += conf.block)
    liveIps = Object.assign(liveIps, await scanIpsBlock(ips.slice(i, i+conf.block), conf, subnet))

  return liveIps
}

window.scanIpsBlock = async function(ips, conf, subnet)
{
  if (!conf) conf = { }
  if (!conf.timeout) conf.timeout = 3000
  if (conf.logger) conf.logger(`scanIpsBlock(${ips})`)
  let promises = {}
  let liveIps = {}
  let scans = []
  const controller = new AbortController()
  const { signal } = controller

  // this is built for high speed and about 200x faster than standard fetch
  let fetchConf = {
    signal: signal,
    method: 'HEAD', // *GET, POST, PUT, DELETE, etc.
    mode: 'cors', // no-cors, *cors, same-origin
    cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
    credentials: 'omit', // include, *same-origin, omit
    headers: { },
    redirect: 'manual', // manual, *follow, error
    referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
  }

  // add ip to our live IPs
  let addLive = async function(lip, time)
  {
    liveIps[lip] = time
    if (conf.networkCallback)
      conf.networkCallback(lip)
    conf.logger(`<b>found potential host: ${lip}</b> ${liveIps[lip]-scanned[lip]}ms (networkCallback called)`)

    // now validate which ips are actually local via webrtc
    if (conf.rtc !== false)
      await connectPeers(lip, function(tip)
      {
        if (conf.logger)
          conf.logger(`<b><span style='color:tomato;'>found LOCAL ip address: ${tip}</span> (localCallback called)</b>`)
        if (conf.localCallback)
          conf.localCallback(tip)
        liveIps[tip] = 0
      })
  }

  // generate success/fail promises first to speed things up
  for (let ip of ips)
    promises[ip] =
      function(e)
      {
        // if we didn't abort, this ip is live!
        if (e.name !== 'AbortError')
          addLive(ip, epoch())
      }

  // stop all fetches after timeout
  let timer = setTimeout(function()
  {
    controller.abort()
  }, conf.timeout)

  // scan our ips
  for (let ip of ips)
  {
    // if we haven't scanned it yet
    if (!scanned[ip])
    {
      //console.log(epoch(), ip)
      scans.push(fetch(`//${ip}:1337/samyscan`, fetchConf).catch(promises[ip]))
      scanned[ip] = epoch()
    }
  }

  // when everything's done scanning, get time in ms
  await Promise.all(scans.map(p => p.catch(e => e))).then(v => {
    for (let [ip, end] of Object.entries(liveIps))
      if (liveIps[ip])
        liveIps[ip] -= scanned[ip]
  })

  // end timer in case it wasn't already
  clearTimeout(timer)

  // if we found subnets, let's scan them
  if (subnet)
    for (let net of Object.keys(liveIps))
    {
      if (conf.logger) conf.logger(`scanIps(${getSubnet(net)}, subnet=false)`)
      Object.assign(liveIps, await scanIps(unroll_ips(getSubnet(net)+'*', 1, 254), conf))
    }

  // return ip: time
  return liveIps
}

// return time
function epoch()
{
  //return performance.now()
  return new Date().getTime()
}

// return subnet from ip address
function getSubnet(ip)
{
  return ip.substr(0, ip.indexOf('.', ip.indexOf('.', ip.indexOf('.')+1)+1)+1)
}

// scan for subnets, then scan discovered subnets for IPs
window.webScanAll = async function(nets, conf)
{
  let ips = {}
  if (!conf) conf = { }
  if (!nets) nets = subnets
  if (conf.logger) conf.logger(`webScanAll() started`)

  // scan possible networks
  ips.network = await scanIps(unroll_ips(nets), conf, true)
  ips.local = Object.keys(ips.network).filter(ip => ips.network[ip] == 0)

  // no local ip? try once more
  if (!ips.local.length)
  {
    if (conf.logger) conf.logger('no local ips found, scanning once more')

    // delete old times
    scanned = {}

    // scan once more
    ips.network = await scanIps(unroll_ips(nets), conf, true)
    ips.local = Object.keys(ips.network).filter(ip => ips.network[ip] == 0)
  }
  return ips
}
})(window)


