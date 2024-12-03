import {parseArgs} from "https://deno.land/std@0.218.2/cli/parse_args.ts";

var args = parseArgs(Deno.args, {
    string: ["port", "key"],
    default: {port: "8000"}
});

var handlers = [];
var nextRequestId = 0;

var openRequests = {};

async function serialiseRequest(request, requestId) {
    var requestLine = `${request.method} ${new URL(request.url).pathname} HTTP/1.1`;

    var headers = [
        ...request.headers.entries().filter((entry) => entry[0] != "x-request-id"),
        ["x-request-id", requestId]
    ].map((part) => `${part[0]}: ${part[1]}`).join("\r\n");

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
    var requestId = null;
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

        if (parts[0].toLowerCase() == "x-request-id") {
            requestId = Number(parts[1]);

            continue;
        }

        headers.append(parts[0], parts[1]);
    }

    return {response: new Response(data.slice(bodyOffset), {status, statusText, headers}), requestId};
}

Deno.serve({port: Number(args.port)}, async function(request) {
    var url = new URL(request.url);

    if (url.pathname == "/.highway") {
        if (request.headers.get("upgrade") != "websocket") {
            return new Response("An `Upgrade` header with the value `\"websocket\"` is required.", {status: 400});
        }

        if (request.headers.get("authorization") != `Bearer ${args.key}`) {
            return new Response("Invalid auth token.", {status: 403});
        }

        var {socket, response} = Deno.upgradeWebSocket(request);

        var handler = function(request, requestId) {
            socket.send(serialiseRequest(request, requestId));
        };

        socket.addEventListener("open", function() {
            handlers.push(handler);
        });

        socket.addEventListener("message", function(event) {
            var {requestId, response} = deserialiseResponse(event.data);

            openRequests[requestId]?.(response);

            delete openRequests[requestId];
        });

        socket.addEventListener("close", function() {
            handlers = handlers.filter((item) => item != handler);
        });

        return response;
    }

    console.log(new TextDecoder().decode(await serialiseRequest(request, 0)));

    if (handlers.length > 0) {
        var randomHandler = handlers[Math.floor(Math.random() * handlers.length)];

        return new Promise(function(resolve, reject) {
            var requestId = nextRequestId++;

            openRequests[requestId] = resolve;

            randomHandler(request, requestId);
        });
    }

    return deserialiseResponse(new TextEncoder().encode(`HTTP/1.1 200 OK\r
Content-Length: 13\r
Content-Type: text/plain\r
\r
Hello, world!
`)).response;
});