import {parseArgs} from "https://deno.land/std@0.218.2/cli/parse_args.ts";

var args = parseArgs(Deno.args, {
    string: ["port", "key"],
    default: {port: "8000"}
});

async function serve(connection) {
    var buffer = new Uint8Array(0);

    function appendData(data) {
        var oldBuffer = buffer;

        buffer = new Uint8Array(buffer.length + data.length);

        buffer.set(oldBuffer, 0);
        buffer.set(data, oldBuffer.length);
    }

    while (true) {
        var readBuffer = new Uint8Array(1024);
        var bytesRead = await connection.read(readBuffer);

        if (bytesRead == null) {
            break;
        }

        appendData(readBuffer.slice(0, bytesRead));

        if (bytesRead < 1024) {
            break;
        }
    }

    console.log(new TextDecoder().decode(buffer));

    await Deno.write(connection.rid, new TextEncoder().encode([
        "HTTP/1.1 200 OK",
        "Content-Length: 13",
        "Content-Type: text/plain",
        "",
        "Hello, world!"
    ].join("\r\n")));
}

for await (var connection of Deno.listen({port: Number(args.port)})) {
    serve(connection);
}