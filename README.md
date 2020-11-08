# webscan

webscan is a browser-based network IP scanner and local-IP resolver. It detects IPs bound to the user/victim as well as IP addresses discovered across any detected subnets.

[try webscan live here](https://samy.pl/webscan/)<br>

by [@SamyKamkar](https://twitter.com/samykamkar)<br>
released 2020/11/07<br>
more fun projects at [https://samy.pl](https://samy.pl)<br>

webscan works like so

1. webscan first iterates through a list of common gateway IP addresses
2. for each IP, use fetch() to make fake HTTP connection to http://common.gateway.ip:1337
3. if a TCP RST returns, the fetch() promise will be rejected before a timeout, indicating a live IP
4. when live gateway detected, step 1-3 reran for every IP on the subnet (<i>e.g. 192.168.0.[1-255]</i>)
5. a WebRTC data channel is opened on the browser, opening a random port on the victim machine
6. for any IPs that are found alive on the subnet, a WebRTC data channel connection is made to that host
7. if the WebRTC data channel is successful, we know we just established a connection to our own local IP
