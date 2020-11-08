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
let ipsToScan = undefined // scan all pre-defined networks
let scan = await webScanAll(
  ipsToScan, // array. if undefined, scan major subnet gateways, then scan live subnets. supports wildcards
  {
    rtc: true,   // use webrtc to detect local ips
    logger: log, // logger callback
    localCallback:   function(ip) { console.log(`local ip callback: ${ip}`)   },
    networkCallback: function(ip) { console.log(`network ip callback: ${ip}`) },
  }
)
```

returns
```javascript
scan = {
  "local": ["192.168.0.109"], // local ip address
  "network": { // other hosts on the network and how fast they respond
    "192.168.100.1": 92.000000000098,
    "192.168.0.1": 97.9999999999563,
    "192.168.0.2": 82.000000000313,
    "192.168.0.100": 46.9999999999345,
    "192.168.0.109": 0,
    "192.168.0.117": 74.999999999818,
    "192.168.0.113": 17.999999999942,
    "192.168.0.112": 21.99999999984,
    "192.168.0.114": 25,
    "192.168.0.116": 25,
    "192.168.0.115": 25,
    "192.168.0.105": 57.999999999898,
    "192.168.0.107": 63.0000000000146,
    "192.168.0.103": 64.9999999999636,
    "192.168.0.108": 31.999999999971
  }
}
```

Tested on
- Chrome 87.0.4280.47 (macOS)
- Edge 86.0.622.63 (Windows)
- Firefox 82.0.2 (macOS)
- Firefox 82.0.2 (Windows 10)
- Safari 13.1.2 (macOS)
- mobile Safari (iOS)
- mobile Chrome (iOS)
