import process, { exit } from "process";
import fs from "fs";

import { Canvas, CanvasRenderingContext2D, FontLibrary, Image } from "skia-canvas";

interface ApiResponse {
    weeklyalbumchart?: {
        album: {
            artist: {
                "#text": string
            },
            url: string,
            name: string,
            "@attr": {
                rank: string,
            },
            playcount: string
        }[]
    },
    album?: {
        image: {
            "#text": string
        }[],
        url: string
    }
};

FontLibrary.use("Font", [
    "fonts/SawarabiGothic-Regular.ttf"
]);

const baseURL = `https://ws.audioscrobbler.com/2.0`;

const count = 16;
const individualSize = 128;
const maximumSize = 768;

const apiKey = process.env["LASTFM_API_KEY"] ?? "";
const apiUser = process.env["LASTFM_USER"] ?? "";

async function getApi(method: string, parameters?: Record<string, string>) : Promise<ApiResponse> {
    let url = new URL(baseURL);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("user", apiUser);
    url.searchParams.set("method", method);
    url.searchParams.set("format", "json")

    if (parameters)
        for (const parameter in parameters) {
            url.searchParams.set(
                parameter, 
                parameters[parameter]
            );
        }

    let response = await fetch(url.toString(), {
        headers: {
            "user-agent": apiUser
        }
    });
    if (response.status != 200)
        console.log(`Unexpected response: HTTP error ${response.status} path: ${url.pathname}`);
    return (await response.json()) as ApiResponse;
}

async function getAlbumCover(artist: string, album: string): Promise<string | undefined> {
    let response = await getApi("album.getinfo", {
        artist, album
    })
    if (!response.album) return;
    return response.album.image[2]["#text"];
}

async function generateChart() {
    let response = await getApi("user.getweeklyalbumchart");
    if (!response.weeklyalbumchart) return;

    let canvasWidth = maximumSize;
    let canvasHeight = Math.ceil(count / (maximumSize / individualSize)) * individualSize;

    let canvas = new Canvas(canvasWidth, canvasHeight);
    let ctx = canvas.getContext("2d");

    ctx.fillStyle = "#000";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.font = "12px Font";

    for (let i = 0; i < count; i += 1) {
        let album = response.weeklyalbumchart.album[i];
        let imageURL = await getAlbumCover(album.artist["#text"], album.name);

        if (album.name.length >= 12) {
            album.name = album.name.substring(0, 12) + "...";
        }

        let x = i % Math.floor(maximumSize / individualSize);
        let y = Math.floor(i / Math.floor(maximumSize / individualSize));

        let imageSize = individualSize - 32;
        let image = new Image();

        ctx.fillRect(
            (x * individualSize) + ((individualSize - imageSize) / 2), 
            (y * individualSize), 
            imageSize, 
            imageSize
        );

        if (imageURL) {
            image.src = imageURL;
            await image.decode();

            ctx.drawImage(
                image,
                (x * individualSize) + ((individualSize - imageSize) / 2), 
                (y * individualSize), 
                imageSize, 
                imageSize
            );
        }

        let measurements = ctx.measureText(album.name);
        ctx.strokeText(album.name, ((x * individualSize) - (measurements.width / 2)) + (individualSize / 2), ((y + 1) * individualSize) - 16);
        ctx.fillText(album.name, ((x * individualSize) - (measurements.width / 2)) + (individualSize / 2), ((y + 1) * individualSize) - 16);

        ctx.strokeText(album["@attr"].rank, (x * individualSize), (y * individualSize) + 12);
        ctx.fillText(album["@attr"].rank, (x * individualSize), (y * individualSize) + 12);

        console.log(`Completed ${i + 1}`);
    };

    console.log("Generated chart")
    await canvas.saveAsSync("chart.svg");

    return;
}

(async () => {
    await generateChart();
    exit(0);
})();