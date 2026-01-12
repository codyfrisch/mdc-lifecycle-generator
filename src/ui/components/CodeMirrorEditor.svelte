<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import {
		autocompletion,
		closeBrackets,
		closeBracketsKeymap,
		completionKeymap,
	} from "@codemirror/autocomplete";
	import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
	import { json, jsonParseLinter } from "@codemirror/lang-json";
	import { type Diagnostic, linter, lintGutter } from "@codemirror/lint";
	import { highlightSelectionMatches } from "@codemirror/search";
	import { EditorState } from "@codemirror/state";
	import {
		EditorView,
		highlightActiveLine,
		highlightActiveLineGutter,
		keymap,
	} from "@codemirror/view";
	import Ajv, { type ValidateFunction } from "ajv";

	// Props
	let { value = $bindable(""), onChange }: { value?: string; onChange?: (value: string) => void } = $props();

	// Container ref
	let container: HTMLDivElement;
	let editorView: EditorView | null = null;

	// JSON Schema for config validation
	const configSchema = {
		$schema: "http://json-schema.org/draft-07/schema#",
		type: "object",
		required: ["app_id", "app_name", "webhook_url", "pricing_version"],
		properties: {
			app_id: { type: "string", description: "The Monday.com app ID" },
			app_name: { type: "string", description: "The name of the app" },
			webhook_url: { type: "string", description: "The webhook URL to send events to" },
			pricing_version: {
				type: "object",
				description: "Map of pricing version keys to pricing version data",
				patternProperties: {
					"^\\d+$": {
						type: "object",
						required: ["plans"],
						properties: {
							plans: {
								type: "object",
								description: "Map of plan IDs to plan configurations",
								patternProperties: {
									"^.+$": {
										type: "object",
										required: ["plan_id", "isFree", "isTrial", "plan_index"],
										properties: {
											plan_id: { type: "string", description: "The plan ID" },
											isFree: { type: "boolean", description: "Whether this is a free plan" },
											isTrial: {
												type: "boolean",
												description: "Whether this is a trial plan",
											},
											plan_index: {
												type: "number",
												description:
													"Order index for upgrade/downgrade comparison (higher = higher tier)",
											},
											max_units: {
												type: ["number", "null"],
												description: "Maximum units allowed for this plan (optional)",
											},
										},
										additionalProperties: false,
									},
								},
								additionalProperties: false,
							},
							freePlan: {
								type: ["string", "null"],
								description: "The plan ID designated as the free plan (optional)",
							},
							trialPlan: {
								type: ["string", "null"],
								description: "The plan ID designated as the trial plan (optional)",
							},
						},
						additionalProperties: false,
					},
				},
				additionalProperties: false,
			},
		},
		additionalProperties: false,
	} as const;

	let validate: ValidateFunction | null = null;

	function initializeSchemaValidation() {
		if (validate) return;
		try {
			const ajv = new Ajv({
				allErrors: true,
				verbose: true,
				strict: false,
			});
			validate = ajv.compile(configSchema);
		} catch (error) {
			console.warn("Failed to initialize schema validation:", error);
		}
	}

	function findPathPosition(text: string, path: string): { from: number; to: number } | null {
		if (!path) return null;
		const pathParts = path.split("/").filter(Boolean);
		if (pathParts.length === 0) return null;
		const lastPart = pathParts[pathParts.length - 1];
		const searchPattern = `"${lastPart}"`;
		let searchIndex = text.indexOf(searchPattern);
		if (searchIndex === -1) {
			searchIndex = text.indexOf(lastPart);
		}
		if (searchIndex !== -1) {
			let endIndex = searchIndex;
			while (
				endIndex < text.length &&
				text[endIndex] !== ":" &&
				text[endIndex] !== "," &&
				text[endIndex] !== "}"
			) {
				endIndex++;
			}
			return { from: searchIndex, to: endIndex };
		}
		return null;
	}

	function schemaLinter(view: EditorView): Diagnostic[] {
		const diagnostics: Diagnostic[] = [];
		const text = view.state.doc.toString().trim();
		if (!text) return diagnostics;
		try {
			const data = JSON.parse(text);
			if (!validate) return diagnostics;
			const valid = validate(data);
			if (!valid && validate.errors) {
				for (const error of validate.errors) {
					let from = 0;
					let to = 0;
					if (error.instancePath) {
						const position = findPathPosition(text, error.instancePath);
						if (position) {
							from = position.from;
							to = position.to;
						}
					}
					if (from === 0 && to === 0 && error.params) {
						const missingProperty = error.params.missingProperty as string | undefined;
						if (missingProperty) {
							const position = findPathPosition(text, `/${missingProperty}`);
							if (position) {
								from = position.from;
								to = position.to;
							}
						}
					}
					if (from === 0 && to === 0) {
						to = Math.min(100, text.length);
					}
					const message = error.message || "Validation error";
					const fullMessage = error.instancePath
						? `${message} (at ${error.instancePath})`
						: message;
					diagnostics.push({
						from,
						to,
						severity: "error",
						message: fullMessage,
					});
				}
			}
		} catch {
			// JSON parse errors are handled by jsonParseLinter
		}
		return diagnostics;
	}

	onMount(() => {
		initializeSchemaValidation();
		if (!container) return;

		const state = EditorState.create({
			doc: value,
			extensions: [
				history(),
				json(),
				lintGutter(),
				linter((view) => {
					const jsonDiagnostics = jsonParseLinter()(view);
					if (jsonDiagnostics.length > 0) {
						return jsonDiagnostics;
					}
					if (validate) {
						return schemaLinter(view);
					}
					return [];
				}),
				highlightActiveLine(),
				highlightActiveLineGutter(),
				highlightSelectionMatches(),
				closeBrackets(),
				autocompletion(),
				keymap.of([
					...closeBracketsKeymap,
					...defaultKeymap,
					...historyKeymap,
					...completionKeymap,
				]),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						const newValue = update.state.doc.toString();
						value = newValue;
						if (onChange) {
							onChange(newValue);
						}
					}
				}),
				EditorView.theme({
					"&": {
						fontSize: "14px",
						height: "400px",
						border: "1px solid #ddd",
						borderRadius: "4px",
					},
					".cm-scroller": {
						overflow: "auto",
					},
					".cm-content": {
						padding: "10px",
					},
					".cm-gutters": {
						backgroundColor: "#f5f5f5",
						border: "none",
					},
				}),
			],
		});

		editorView = new EditorView({
			state,
			parent: container,
		});
	});

	// Update editor when value prop changes externally
	$effect(() => {
		if (editorView && value !== editorView.state.doc.toString()) {
			const transaction = editorView.state.update({
				changes: {
					from: 0,
					to: editorView.state.doc.length,
					insert: value,
				},
			});
			editorView.dispatch(transaction);
		}
	});

	onDestroy(() => {
		if (editorView) {
			editorView.destroy();
			editorView = null;
		}
	});
</script>

<div bind:this={container}></div>
