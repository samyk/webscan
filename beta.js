/*
 * cross-browser/cross-platform browser-based network scanner and local ip detector
 * by samy kamkar 2020/11/07
 * https://samy.pl
 */

(function(window, document) {

const DEFAULT_SCANNER = 'fetch'

const DEFAULT_CONF = {
  block: 10, // number of IPS to scan at once
  timeout: 2000, // timeout before stopping the scan of the block
  logger: line => console.log(line),
  ports: [1337, 1338, 1339], // ports to attempt to connect to
}

// scanners - img, fetch
let scanners = { /*
  'scanner': {
    // runs before the scan
    async start(ips) { },
    // runs for every ip. make sure to call isLive(ip) if the ip is up and isLocal(ip) if ip is local
    async scan (ip) { },
    // called when we've timed out. stop all calls
    async stop(ips) { },
    // called by us when ip is alive
    async live(ip) { },
    // called by us when ip is bound locally
    async local(ip) { },
  }, */

  fetch:
  {
    async start(ips)
    {
      this.controller = new AbortController()
      this.promises = {}

      // this is built for high speed and about 200x faster than standard fetch
      this.fetchConf = {
        signal: this.controller.signal,
        method: 'GET', // *GET, POST, PUT, DELETE, etc.
        mode: 'cors', // no-cors, *cors, same-origin
        cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'omit', // include, *same-origin, omit
        headers: { },
        redirect: 'manual', // manual, *follow, error
        referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
      }

      //console.log(`fstart()`)
      // generate success/fail promises first to speed things up
      for (let ip of ips)
        this.promises[ip] = (e) => {
          // if we didn't abort, this ip is live!
          if (e.name !== 'AbortError')
            isLive(ip)
        }
    }, // end start

    async scan(ip)
    {
      //console.log(`fscan(${ip})`)
      return fetch(`//${ip}:${port}/samyscan`, this.fetchConf).catch(this.promises[ip])
    }, // end scan

    async stop(ips)
    {
      //console.log(`fstop()`)
      this.controller.abort()
    }, // end stop

    async live(ip)
    {
      console.log(`flive(${ip})`)
      // let's see if this is a local ip
      if (conf.rtc !== false)
        await connectPeers(ip, ip => isLocal(ip))
    },

    async local(ip)
    {
      console.log(`flocal(${ip})`)
    },

  }, // end fetch[]

  img:
  {
    async start(ips)
    {
      //console.log(`istart()`)
      this.imgs = {}

      for (let ip of ips)
      {
        this.imgs[ip] = new Image()
        this.imgs[ip].id = `webscanimg${ip}`
        this.imgs[ip].onerror = this.imgs[ip].onload = () => {
          console.log('TRIGGERED', ip)
          isLive(ip)
        }
      }

    }, // end start

    async scan(ip)
    {
      //console.log(`iscan(${ip})`)
      this.imgs[ip].src = `//${ip}:${port}/samyscan.png`
    }, // end scan

    async stop(ips)
    {
      //console.log(`istop()`)
      for (let ip of ips)
      {
        this.imgs[ip].onerror = this.imgs[ip].onload = () => { }
        this.imgs[ip].src = pixel_img // end the socket
        this.imgs[ip].remove() // remove dom object
      }
    }, // end stop

    async live(ip)
    {
      //console.log(`ilive(${ip})`)
      // let's see if this is a local ip
      if (conf.rtc !== false)
        await connectPeers(ip, ip => isLocal(ip))
    },

    async local(ip)
    {
      console.log(`ilocal(${ip})`)
    },

  } // end fetch[]
}

// set default configs, use passed in config as overrides
function setConf(c)
{
  if (typeof c === 'object')
    Object.assign(conf, c)
}

// our scanner
let scan
let port = DEFAULT_CONF.ports[0]

// scanned ips
let scanned = {}

// live ips
let liveIps = {}
let live = {}

// scan promises
let scans = []

// global config
let conf = DEFAULT_CONF

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

// 1x1 transparent pixel
const pixel_img = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

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

  // Handle onmessage events for the receiving channel.
  // These are the data messages sent by the sending channel.
  let handleReceiveMessage = async function(event)
  {
    console.log(`handleReceiveMessage: ${ip} ${event}: ${event.data}`)
    success(ip)
    console.log(event.ice)
  }

  // Called when the connection opens and the data
  // channel is ready to be connected to the remote.
  let receiveChannelCallback = async function(event)
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
    //sendChannel.onopen = async function(e) { success(ip) }
    sendChannel.onopen = handleSendChannelStatusChange
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
window.scanIps = async function(ips, c, subnet)
{
  setConf(c)

  conf.logger(`scanIps() started, subnet=${!!subnet}`)

  // scan blocks of IPs
  for (let i = 0; i < ips.length; i += conf.block)
    Object.assign(liveIps, await scanIpsBlock(ips.slice(i, i+conf.block), null, subnet))

  return liveIps
}

// if ip is local
async function isLocal(ip)
{
  console.log('is local!')
  live[ip] = 0

  conf.logger(`<b><span style='color:tomato;'>found LOCAL ip address: ${ip}</span> (localCallback called)</b>`)

  if (conf.localCallback)
    conf.localCallback(ip)

  // hit callback
  if (scan.local) scan.local(ip)
}

// if ip is alive
async function isLive(ip)
{
  live[ip] = now()

  if (conf.networkCallback)
    conf.networkCallback(ip)

  conf.logger(`<b>found host: ${ip}</b> ${live[ip]-scanned[ip]}ms (networkCallback called)`)

  // hit callback
  if (scan.live) scan.live(ip)
} // end live

window.scanIpsBlock = async function(ips, c, subnet)
{
  setConf(c)
  conf.logger(`scanIpsBlock(${ips})`)

  scan = scanners[conf.scanner] || scanners[DEFAULT_SCANNER]
  // clear previous scans/live ips
  scans = []
  live = {}

  // prepare things
  await scan.start(ips)

  // stop all requests after timeout
  let timer
  let timeout = new Promise(r =>
    // keep track of our timer so we can end it early if we end sooner
    timer = setTimeout(() => {
      // stop scan at the timeout
      console.log('stopped')
      scan.stop(ips)
      r()
    }, conf.timeout)
  )

  // scan our ips
  for (let ip of ips)
    // if we haven't scanned it yet
    if (!scanned[ip])
    {
      scanned[ip] = now()
      scans.push(scan.scan(ip))
    }

  // when everything's done scanning (assuming we returned promises)
  // XXX fix this...
  /*
  if (typeof scans[0] === 'object' && typeof scans[0].then === 'function')
  {
    let allScans = Promise.all(scans.map(p => p.catch(e => e)))
    // wait for either our timeout or all scans to finish
    await Promise.race(timeout, allScans)
  }
  else
  */
    await timeout

  // end timer in case it wasn't already
  clearTimeout(timer)

  // calculate times of scans
  for (let ip of Object.keys(live))
    if (live[ip])
      live[ip] -= scanned[ip]

  // if we found subnets, let's scan them
  if (subnet)
    for (let net of Object.keys(live))
    {
      if (conf.subnetCallback)
        conf.subnetCallback(net)
      conf.logger(`scanIps(${getSubnet(net)}, subnet=false) (subnetCallback called)`)
      Object.assign(live, await scanIps(unroll_ips(getSubnet(net)+'*', 1, 254)))
    }

  // return ip: time
  return live
}

// return time
function now()
{
  return (new Date()).getTime()
}

// return subnet from ip address
function getSubnet(ip)
{
  return ip.substr(0,
    ip.indexOf('.',
      ip.indexOf('.',
        ip.indexOf('.')+1)+1)+1)
}

// scan for subnets, then scan discovered subnets for IPs
window.webScanAll = async function(nets, c)
{
  setConf(c)

  // XXX Chrome acting funky on https, need to investigate
  if (location.protocol === 'https:' && !c.noRedirect)
    return location.protocol = 'http:'

  scanned = {}

  let ips = { network: {}, local: [] }
  nets = nets || subnets

  conf.logger(`webScanAll() started`)

  async function scanNets()
  {
    // scan possible networks
    ips.network = await scanIps(unroll_ips(nets), null, true)
    ips.local = Object.keys(ips.network).filter(ip => ips.network[ip] == 0)
  }
  await scanNets()

  // no local ip? try once more
  if (!ips.local.length)
  {
    port = conf.ports[1]
    conf.logger('no local ips found, scanning once more')

    // delete old times
    scanned = {}

    // scan once more
    await scanNets()
  }
  return ips
}

// run the code in our <script> tag
eval(document.currentScript.innerText)

})(this, document)
