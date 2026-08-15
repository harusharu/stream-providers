# Worker Protocol

Workers speak newline-delimited JSON over stdin/stdout. **stdout carries
only the protocol** — all provider `console.log` output is redirected to
stderr so a scraper's debug output can never corrupt the channel.

```text
in:  {"id":1,"method":"call","params":{"provider":"vega","module":"posts","fn":"getSearchPosts","args":{...}}}
out: {"id":1,"ok":true,"data":{...}}
out: {"id":1,"ok":false,"error":{"message":"...","status":502}}
in:  {"id":2,"method":"ping"}
out: {"id":2,"ok":true,"data":{"pong":true}}
```
