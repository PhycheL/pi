/**
 * Minimal runner for @earendil-works/pi-agent-core.
 * The model is scripted, so the loop can be stepped without an API key.
 */
import { Agent, type AgentTool } from "@earendil-works/pi-agent-core";
import { createModels, fauxAssistantMessage, fauxProvider, fauxText, fauxToolCall, Type } from "@earendil-works/pi-ai";

const faux = fauxProvider({ tokensPerSecond: 200, tokenSize: { min: 8, max: 8 } });
const models = createModels();
models.setProvider(faux.provider);

const echo: AgentTool = {
	name: "echo",
	label: "Echo",
	description: "Repeat the given text.",
	parameters: Type.Object({ text: Type.String() }),
	execute: async (_toolCallId, params) => {
		console.log(`\n  execute echo(${JSON.stringify(params.text)})`);
		return { content: [{ type: "text", text: params.text }], details: {} };
	},
};

// Turn 1 calls the tool. Turn 2 answers from the tool result.
faux.setResponses([
	fauxAssistantMessage([fauxToolCall("echo", { text: "hello" }), fauxText("calling echo")], {
		stopReason: "toolUse",
	}),
	fauxAssistantMessage("echo said hello"),
]);

const agent = new Agent({
	initialState: {
		systemPrompt: "You are a tiny demo.",
		model: faux.getModel(),
		tools: [echo],
	},
	streamFn: models.streamSimple.bind(models),
});

agent.subscribe((event) => {
	if (event.type === "message_update") {
		if (event.assistantMessageEvent.type === "text_delta") {
			process.stdout.write(event.assistantMessageEvent.delta);
		}
		return;
	}
	const extra = "toolName" in event ? ` ${event.toolName}` : "";
	console.log(`[${event.type}]${extra}`);
});

await agent.prompt("say hello through the echo tool");
console.log("\nroles:", agent.state.messages.map((message) => message.role).join(" -> "));
