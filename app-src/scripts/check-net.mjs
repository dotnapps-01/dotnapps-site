// Which addresses a webhook may be sent to. Pure logic, no server needed:  npm run check:net
// (Node 22 runs the TypeScript file directly.)
import { isPrivateIp } from "../lib/net-safety.ts";
let pass = 0, fail = 0;
const t = (ok, msg) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", msg); };
const blocked = [
  "127.0.0.1", "127.255.255.254", "10.0.0.1", "10.255.255.255", "172.16.0.1", "172.31.255.255", "192.168.0.1", "169.254.169.254", "169.254.0.1", "100.64.0.1", "100.127.255.255",
  "0.0.0.0", "0.1.2.3", "224.0.0.1", "239.255.255.255", "240.0.0.1", "255.255.255.255", "198.18.0.1", "192.0.2.5", "198.51.100.5", "203.0.113.5",
  "::", "::1", "0:0:0:0:0:0:0:1", "0000:0000:0000:0000:0000:0000:0000:0001", "::ffff:127.0.0.1", "::ffff:7f00:1", "0:0:0:0:0:ffff:7f00:1", "::ffff:10.1.2.3", "::ffff:169.254.169.254", "::ffff:a9fe:a9fe",
  "::127.0.0.1", "fc00::1", "fd12:3456:789a::1", "fe80::1", "febf::1", "ff02::1", "64:ff9b::7f00:1", "2001:db8::1", "2001::1", "2002:7f00:1::1", "2002:a9fe:a9fe::", "fe80::1%eth0",
  "not an ip", "", "999.1.1.1", "1.2.3", "::g",
];
const allowed = ["8.8.8.8", "1.1.1.1", "172.15.255.255", "172.32.0.1", "100.63.255.255", "100.128.0.1", "169.253.1.1", "192.0.1.1", "198.17.255.255", "198.20.0.1", "203.0.114.1", "223.255.255.255", "2606:4700:4700::1111", "2a00:1450:4001:81b::200e", "2002:808:808::", "::ffff:8.8.8.8", "::ffff:808:808", "fbff::1", "fec0::1"];
for (const ip of blocked) t(isPrivateIp(ip), `blocked: ${JSON.stringify(ip)}`);
for (const ip of allowed) t(!isPrivateIp(ip), `allowed: ${ip}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
