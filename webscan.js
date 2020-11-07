/*
 * web-based network scanner
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

// convert * in ips to 0..255
var unroll_ips = function(ips)
{
  // convert single ip to array
  if (typeof(ips) === 'string')
    ips = [ips]

  // flatten *
  return ips.flatMap(ip =>
    ip.indexOf('*') != -1 ?
    [...Array(256).keys()].map(i => ip.replace('*', i)) :
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
  if (window.location.protocol != 'http')
    window.location.protocol = 'http'

  if (!conf) conf = { }
  if (!conf.timeout) conf.timeout = 1000
  if (conf.logger) conf.logger(`scanIpsBlock(${ips})`)
  let promises = {}
  let liveIps = {}
  let scans = []
  const controller = new AbortController()
  const { signal } = controller

  // add ip to our live IPs
  let addLive = function(ip, time) { liveIps[ip] = time }

  // generate success/fail promises first to speed things up
  for (var ip of ips)
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
  let start = new Date().getTime()
  for (var ip of ips)
    scans.push(fetch(`http://${ip}:1337/samyscan`, { signal }).then(promises[ip]).catch(promises[ip]))

  // when everything's done scanning, get time in ms
  await Promise.all(scans.map(p => p.catch(e => e))).then(v => {
    if (conf.logger) conf.logger('scanIpsBlock promises done')
    for (var [ip, end] of Object.entries(liveIps))
      liveIps[ip] -= start
  })
  if (conf.logger) conf.logger('scanIpsBlock done')

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
  let possible = []
  if (!conf) conf = { }
  if (!nets) nets = subnets
  if (conf.logger) conf.logger(`webScanAll() started`)

  // first get our possible networks
  nets = await scanIps(unroll_ips(nets, conf))

  // now let's scan each block of 256 IPs per net
  for (var net of Object.keys(nets))
  {
    if (conf.logger) conf.logger(`scanIps(${getSubnet(net)})`)
    possible.push(await scanIps(unroll_ips(getSubnet(net)+'*'), conf))
  }

  return possible
}
})(window)