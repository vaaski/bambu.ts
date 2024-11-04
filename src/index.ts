import { TypedEmitter } from "tiny-typed-emitter"

import mqtt from "mqtt"

import type { BambuState } from "../types/bambu"
import { merge } from "ts-deepmerge"

export type { BambuState } from "../types/bambu"

export type BambuConstructorOptions = {
	host: string
	port?: string | number
	username?: string
	password: string
	serial: string

	autoconnect?: boolean
}

type BambuEvents = {
	connect: () => void
	disconnect: () => void
	state: (state: BambuState) => void
}

const defaultOptions: Partial<BambuConstructorOptions> = {
	port: 8883,
	username: "bblp",
	autoconnect: true,
}

export class Bambu extends TypedEmitter<BambuEvents> {
	private readonly options: BambuConstructorOptions
	public readonly client: mqtt.MqttClient

	private readonly commandTopic: string
	private readonly reportTopic: string
	private readonly address: string

	private _state?: BambuState

	constructor(options: BambuConstructorOptions) {
		super()

		this.options = { ...defaultOptions, ...options }

		this.commandTopic = `device/${this.options.serial}/request`
		this.reportTopic = `device/${this.options.serial}/report`
		this.address = `mqtts://${this.options.host}:${this.options.port}`

		this.client = mqtt.connect(this.address, {
			manualConnect: !this.options.autoconnect,
			username: this.options.username,
			password: this.options.password,
			reconnectPeriod: 30,
			rejectUnauthorized: false,
		})

		this.client.on("connect", () => {
			this.emit("connect")
			this.client.subscribe(this.reportTopic)
			this.refreshState()
		})

		this.client.on("disconnect", () => {
			this.emit("disconnect")
		})

		this.client.on("message", this.handleMessage)
	}

	private readonly handleMessage = (topic: string, message: Buffer) => {
		const parsed = JSON.parse(message.toString()) as BambuState

		if (!this._state) this._state = parsed
		this._state = merge.withOptions(
			{ mergeArrays: false, uniqueArrayItems: false },
			this._state,
			parsed,
		)

		this.emit("state", this._state)
	}

	private readonly sendCommandRaw = (command: string) => {
		this.client.publish(this.commandTopic, command)
	}

	private readonly sendCommand = (command: object) => {
		this.sendCommandRaw(JSON.stringify(command))
	}

	private readonly commandFactory = (command: object) => {
		return () => this.sendCommand(command)
	}

	// --------------------------------------------------------------------------------

	public readonly refreshState = this.commandFactory({ pushing: { command: "pushall" } })
	public readonly pausePrint = this.commandFactory({ print: { command: "pause" } })
	public readonly stopPrint = this.commandFactory({ print: { command: "stop" } })
	public readonly resumePrint = this.commandFactory({ print: { command: "resume" } })

	public readonly setLight = (state: boolean) => {
		this.sendCommand({ system: { led_mode: state ? "on" : "off" } })
	}
}
