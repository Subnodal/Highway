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

Deno.serve({port: Number(args.port)}, async function(request) {
    console.log(new TextDecoder().decode(await serialiseRequest(request)));

    return new Response("OK");
});