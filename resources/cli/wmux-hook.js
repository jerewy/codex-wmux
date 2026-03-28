#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * wmux hook helper — sends a hook event to the wmux pipe.
 * Called by Claude Code PostToolUse hooks.
 * Usage: node wmux-hook.js <tool-name>
 */
const net_1 = __importDefault(require("net"));
const tool = process.argv[2] || 'unknown';
const pipePath = '\\\\.\\pipe\\wmux';
const client = net_1.default.connect({ path: pipePath }, () => {
    const msg = JSON.stringify({ method: 'hook.event', params: { tool }, id: 1 });
    client.write(msg + '\n', () => client.end());
});
client.on('error', () => {
    // wmux not running — silently ignore
    process.exit(0);
});
