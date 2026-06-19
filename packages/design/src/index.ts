/**
 * @crestly/design — Crestly Design System
 *
 * Consumers should pull the two stylesheets in this order:
 *   import "@crestly/design/styles/tokens.css";
 *   import "@crestly/design/styles/components.css";
 *
 * The CSS files are the verbatim PHP sources (erp/assets/css/), preserved
 * to guarantee pixel fidelity with the legacy app. Every class used in
 * the PHP templates resolves identically here.
 *
 * Use the TS tokens (./tokens) when you need a value at runtime — e.g.
 * the per-tenant brand-colour override emitted from the React root layout.
 */
export * as tokens from "./tokens";
