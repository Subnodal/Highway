import {parseArgs} from "https://deno.land/std@0.218.2/cli/parse_args.ts";

var args = parseArgs(Deno.args, {
    string: ["port", "key"],
    default: {port: "8000"}
});

async function serialiseRequest(request) {
    var requestLine = `${request.method} ${new URL(request.url).pathname} HTTP/1.1`;
    var headers = [...request.headers.entries()].map((part) => `${part[0]}: ${part[1]}`).join("\r\n");
    var headerData = new TextEncoder().encode(`${requestLine}\r\n${headers}\r\n\r\n`);
    var body = request.body ? new Uint8Array(await request.arrayBuffer()) : new Uint8Array();
    var data = new Uint8Array(headerData.length + body.length);

    data.set(headerData, 0);
    data.set(body, headerData.length);

    return data;
}

function deserialiseResponse(data) {
    var text = new TextDecoder("ascii").decode(data);
    var bodyOffset = text.split("\r\n\r\n")[0].length + 4;
    var lines = text.split("\r\n");
    var statusLine = lines.shift();
    var headers = new Headers();
    var statusMatch;
    var status = null;
    var statusText = null;

    if (statusMatch = statusLine?.match(/HTTP\/\d+(?:\.\d+) (\d+) (.+)/)) {
        status = Number(statusMatch[1]);
        statusText = statusMatch[2];
    }

    for (var line of lines) {
        if (line == "") {
            break;
        }

        var parts = line.split(": ");

        headers.append(parts[0], parts[1]);
    }

    return new Response(data.slice(bodyOffset), {status, statusText, headers});
}

Deno.serve({port: Number(args.port)}, async function(request) {
    console.log(new TextDecoder().decode(await serialiseRequest(request)));

    return deserialiseResponse(new TextEncoder().encode(`HTTP/1.1 200 OK\r
Content-Length: 13\r
Content-Type: text/plain\r
\r
Hello, world!
`));
});