My PC could download at 191 Mbps, yet with the connection idle, a ping
to the router took as long as 330 ms. After the changes, the peak dropped
to 12 ms and download speeds held close to 198 Mbps across two runs.
The biggest improvement was stability.

I used an AI agent to guide the tests on Windows 11. The first scan
showed a strong signal sharing the same block of Wi-Fi channels. I
thought it was a neighbor's network. It was my own second router.

:::takeaways
- Compare the router's response time with an internet endpoint, both at idle and under load.
- If you have two routers, check the channel width on both. Different channel numbers can cover the same frequencies.
- Change one thing at a time when possible. Repeat the test from the same spot to see whether the improvement holds.
:::

## Two routers sharing the same 5 GHz channels

I started with the PC. I switched to the dedicated 5 GHz network, set
the adapter to prefer that band, and lowered its roaming aggressiveness,
which controls how readily it looks for another access point. I also
turned off adapter power saving and switched DNS resolvers after timing
some queries. The first round showed a much lower idle peak, but download
speeds varied and the router still took up to 116 ms to respond during
the download. I changed several Windows settings in one pass, so the
result reflects their combined effect.[^windows]

My main router, an **Askey RTF8115VW**, used channel 161. The
**TP-Link Archer C50 v4** was wired to it and used channel 149. Both used
80 MHz of bandwidth, which put them in the same channel block, from 149
to 161. The settings showed two channel numbers, but the radios were
competing for the same airtime.[^channels]

The Askey reverted to automatic channel selection when I tried to set a
different channel. I left the main router where it was and moved the
TP-Link to **channel 44 at 40 MHz**, in a different block. The Archer's
100 Mbps Ethernet ports already cap the internet traffic that passes
through it. The retest below measured the PC on the main router.[^archer]

## Before and after

I kept the PC in the same spot and used the same tool and Cloudflare
server. I finished the idle pings before starting the speed test. I
measured response times during transfers in a separate, loaded phase.[^load]

| Measurement | Before | After PC changes | After separating channels |
| --- | ---: | ---: | ---: |
| Peak idle ping to the router | 330 ms | 26 ms | **12 ms** |
| Variation between router pings (jitter) | 41.6 ms | 2.9 ms | **0.86 ms** |
| Packets lost in 30 pings to the router | 1 | 1 | **0** |
| Download | 191.3 Mbps | 160.5–178.1 Mbps | **196.7–198.6 Mbps** |
| Upload | 104.7 Mbps | 100.7 Mbps | **105.7 Mbps** |

The speed gain from the original baseline was modest. The biggest change
was how consistently the router responded. **Zero packets lost** is the
result for that sample of 30 pings.

In the final tests, latency to the test server was still **47 to 81 ms
above idle** during upload. That is consistent with data piling up in
queues under load, a problem called *bufferbloat*. A wired test would be
the next step to see how much of that delay persists without Wi-Fi.[^load]

## The prompt to copy

Choose an advanced model in an agent with terminal access on the **PC
connected to Wi-Fi**. Google Antigravity, Codex, Claude Code, or any other
agent with that access can run the checks. If you are using a chat without
local terminal access, ask for the commands and remove network identifiers
before sharing the results.

```text title="Wi-Fi diagnosis prompt" wrap
Help me improve Wi-Fi speed and stability on this Windows PC. Reply
in English and explain your conclusions in plain language. Ask what
the symptom is, when it happens, what speed I pay for, and what routers,
extenders or access points I use. If I have more than one, ask how
they are connected.

If you are in a remote environment or have no local terminal access,
give me the steps or commands to run on the PC and wait for my results.

Start with measurements only. Before changing any setting, show what
you plan to change, its current value and how to restore it. Wait for
my approval. Tell me if a change could interrupt the connection. Leave
network names, MAC addresses and public IPs out of the report. Never
retrieve passwords.

Run these checks in order on the PC connected to Wi-Fi:

1. Identify the adapter, band, channel, channel width, signal and link
   rate. Check recent disconnection events. Use the nearby network list
   to see which channel blocks overlap. Confirm which strong signals
   come from devices in my own home. Flag any data the driver or
   adapter does not expose.
2. With the connection idle, check for downloads, sync jobs or VPNs.
   Ping the router 30 times, then ping a responsive public endpoint
   30 times. Record the median, spikes and packet loss. If I have a
   cable, suggest repeating the test over Ethernet for comparison.
   Finish idle pings before starting the load test.
3. If pages are slow to start loading, compare the current DNS resolver
   with alternatives using the same domains. Measure cached and uncached
   queries separately when feasible.
4. Measure download, upload, idle latency and loaded latency. If you
   also ping the router during transfers, label those as loaded
   measurements. If a step is manual, say what to do and what to report.

Show a table of measurements and rank up to three hypotheses, with the
evidence for each and a test that would help confirm it. Start with
simple, reversible changes. Confirm the router models and work with
the settings they offer. If channels overlap, suggest a channel block
and width based on what the scan shows.

After each change, repeat the same tests with the PC in the same spot,
using the same tool and server with similar background traffic. Compare
before and after. If the change is small or varies across runs, say
that the improvement is still unconfirmed.
```

## Where I would start in another home

- **Only one PC is unstable.** Test closer to the router and try a
  dedicated 5 GHz network where the signal is strong. On a laptop,
  test power settings while plugged in and consider the battery cost.
- **There are two routers or access points.** Compare the channel
  blocks and widths before picking new settings. On 2.4 GHz, start
  by comparing channels 1, 6 and 11 at 20 MHz. On the Archer, setting
  the channel and width back to `Auto` reverses this change.[^channels]
- **Latency spikes when someone is using the connection heavily.**
  Repeat the test over Ethernet if you can. If the delay persists,
  check whether the router offers SQM, a way to manage traffic queues.[^sqm]

:::callout{type=tip title="A test you can run in the browser"}
Cloudflare's speed test reports throughput, idle latency and loaded latency.
Finish your idle pings before starting it, then use the same tool for your
comparison. [Cloudflare Speed Test](https://speed.cloudflare.com/)
:::

If speeds stay about the same and the spikes shrink in repeated tests,
I keep the change. That was the improvement that mattered most on my PC.

[^windows]: The Windows wireless network report collects connection events and adapter information. [Microsoft](https://support.microsoft.com/en-us/windows/experience/connectivity-networking/analyze-the-wireless-network-report)
[^channels]: On 5 GHz, an 80 MHz block combines four 20 MHz channels. Check both the width and the primary channel when looking for overlap. [Channel bonding, Cisco Meraki](https://documentation.meraki.com/Wireless/Operate_and_Maintain/User_Guides/Radio_Settings/Channel_Bonding) · [Channels and widths, Microsoft](https://support.microsoft.com/en-us/windows/experience/connectivity-networking/wi-fi-and-your-home-layout)
[^archer]: The Archer C50 v4 specs list one WAN and four LAN ports rated at 10/100 Mbps. [TP-Link](https://www.tp-link.com/ca/home-networking/wifi-router/archer-c50/v4/)
[^load]: These measurements came from a local script using four HTTPS streams against a Cloudflare server. The browser test is an alternative for running your own comparison. [How Cloudflare measures loaded latency](https://blog.cloudflare.com/how-does-cloudflares-speed-test-really-work/)
[^sqm]: SQM manages queues while the connection is busy. [A CoDel example, Netgate](https://docs.netgate.com/pfsense/en/latest/recipes/codel-limiters.html)
