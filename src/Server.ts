import "missing-native-js-functions";
import fs from "fs/promises";
import { Connection } from "mongoose";
import { Server, ServerOptions } from "lambert-server";
import { Authentication, GlobalRateLimit } from "./middlewares/";
import Config from "./util/Config";
import { db } from "fosscord-server-util";
import i18next from "i18next";
import i18nextMiddleware, { I18next } from "i18next-http-middleware";
import i18nextBackend from "i18next-node-fs-backend";
import { ErrorHandler } from "./middlewares/ErrorHandler";
import { BodyParser } from "./middlewares/BodyParser";

export interface DiscordServerOptions extends ServerOptions {}

declare global {
	namespace Express {
		interface Request {
			// @ts-ignore
			server: DiscordServer;
		}
	}
}

export class DiscordServer extends Server {
	public options: DiscordServerOptions;

	constructor(opts?: Partial<DiscordServerOptions>) {
		// @ts-ignore
		super({ ...opts, errorHandler: false, jsonBody: false });
	}

	async setupSchema() {
		await db.collection("users").createIndex({ id: 1 }, { unique: true });
		await db.collection("messages").createIndex({ id: 1 }, { unique: true });
		await db.collection("channels").createIndex({ id: 1 }, { unique: true });
		await db.collection("guilds").createIndex({ id: 1 }, { unique: true });
		await db.collection("members").createIndex({ id: 1, guild_id: 1 }, { unique: true });
		await db.collection("roles").createIndex({ id: 1 }, { unique: true });
		await db.collection("emojis").createIndex({ id: 1 }, { unique: true });
	}

	async start() {
		// @ts-ignore
		await (db as Promise<Connection>);
		await this.setupSchema();
		console.log("[DB] connected");
		await Promise.all([Config.init()]);

		this.app.use(GlobalRateLimit);
		this.app.use(Authentication);
		this.app.use(BodyParser({ inflate: true }));
		const languages = await fs.readdir(__dirname + "/../locales/");
		const namespaces = await fs.readdir(__dirname + "/../locales/en/");
		const ns = namespaces.filter((x) => x.endsWith(".json")).map((x) => x.slice(0, x.length - 5));

		await i18next
			.use(i18nextBackend)
			.use(i18nextMiddleware.LanguageDetector)
			.init({
				preload: languages,
				// debug: true,
				fallbackLng: "en",
				ns,
				backend: {
					loadPath: __dirname + "/../locales/{{lng}}/{{ns}}.json",
				},
				load: "all",
			});
		this.app.use(i18nextMiddleware.handle(i18next, {}));

		this.routes = await this.registerRoutes(__dirname + "/routes/");
		this.app.use(ErrorHandler);
		const indexHTML = await fs.readFile(__dirname + "/../client_test/index.html");

		// this.app.get("*", (req, res) => {
		// 	res.set("Cache-Control", "public, max-age=" + 60 * 60 * 24);
		// 	res.set("content-type", "text/html");
		// 	res.send(indexHTML);
		// });
		return super.start();
	}
}
