# webscan

webscan is a browser-based network IP scanner and local-IP detector. It detects IPs bound to the user/victim as well as IP addresses discovered across any detected subnets. Works on mobile and desktop across all major browsers and OS's.

[try webscan live here](https://samy.pl/webscan/)<br>

by [@SamyKamkar](https://twitter.com/samykamkar)<br>
released 2020/11/07<br>
more fun projects at [samy.pl](https://samy.pl)<br>

webscan works like so
1. webscan first iterates through a list of common gateway IP addresses
2. for each IP, use fetch() to make fake HTTP connection to http://common.gateway.ip:1337
3. if a TCP RST returns, the fetch() promise will be rejected before a timeout, indicating a live IP
4. when live gateway detected, step 1-3 reran for every IP on the subnet (<i>e.g. 192.168.0.[1-255]</i>)
5. a WebRTC data channel is opened on the browser, opening a random port on the victim machine
6. for any IPs that are found alive on the subnet, a WebRTC data channel connection is made to that host
7. if the WebRTC data channel is successful, we know we just established a connection to our own local IP

### implementation
```javascript
// wait for scan to finish
let scanResults = await webScanAll()

// or get callbacks when ips are found with a promise
let ipsToScan = undefined // scans all pre-defined networks if null
let scanPromise = webScanAll(
  ipsToScan, // array. if undefined, scan major subnet gateways, then scan live subnets. supports wildcards
  {
    rtc: true,   // use webrtc to detect local ips
    logger: l => console.log(l),  // logger callback
    localCallback:   function(ip) { console.log(`local ip callback: ${ip}`)   },
    networkCallback: function(ip) { console.log(`network ip callback: ${ip}`) },
  }
)
```

returns
```javascript
scanResults = {
  "local": ["192.168.0.109"], // local ip address
  "network": { // other hosts on the network and how fast they respond
    "192.168.0.1": 97,
    "192.168.0.2": 82,
    "192.168.0.100": 46,
    "192.168.0.109": 0,
    "192.168.0.117": 74,
    "192.168.0.113": 17,
    "192.168.0.112": 21,
    "192.168.0.114": 25,
    "192.168.0.116": 25,
    "192.168.0.115": 25,
    "192.168.0.105": 57,
    "192.168.0.107": 63,
    "192.168.0.103": 64,
    "192.168.0.108": 31
  }
}
```

Todo
- use iframe to perform scans in blocks
  - when the frame is torn down, i assume this helps guarantee the connections are torn down
  - how do multiple iframes scanning multiple blocks work? perhaps this allows us to bypass browser conncetion rate limiting
- support both fetch and img as scanner cores
  - Safari
    - note: img tag works really well in some browsers like Safari
    - caveat: changing the .src doesn't seem to abort the connection
    - potential solution: see iframe note above
  - Chrome
    - caveat: chrome will not abort the connection if you remove the img from dom
    - solution: chrome will abort the connection of an img if you adjust the .src, this is great!
    - caveat: changing the img.src to '#' makes another request to the same parent page
    - caveat: changing the img.src to 'about:' produces a warning in console, is there something else to use that won't make a request?
- use img timing as a local ip detection mechanism

Tested on
- Chrome 87.0.4280.47 (macOS)
- Edge 86.0.622.63 (Windows)
- Firefox 82.0.2 (macOS)
- Firefox 82.0.2 (Windows 10)
- Safari 13.1.2 (macOS)
- mobile Safari (iOS)
- mobile Chrome (iOS)
