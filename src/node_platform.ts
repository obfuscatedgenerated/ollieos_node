import { AbstractPlatformAPI, type PlatformCapability } from "ollieos/src/kernel/platform";
import open from "open";

// how long shutdown waits for an opener to hand off, as we don't know what it is opening or how it behaves
const OPEN_HANDOFF_TIMEOUT_MS = 5000;

/**
 * The platform API when running in node.
 */
export class NodePlatformAPI extends AbstractPlatformAPI {
    readonly #pending_opens = new Set<Promise<void>>();

    get_platform_name(): string {
        return "node";
    }

    get_capabilities(): PlatformCapability[] {
        return [];
    }

    protected async _call_internal(capability_name: string): Promise<unknown> {
        throw new Error(`Platform capability "${capability_name}" is not available on node`);
    }

    protected async _open_url(url: URL): Promise<void> {
        const child = await open(url.toString());

        // exiting straight after (e.g. echo "repo" | ollieos) can stop the opener before it hands off, mostly on windows, so shutdown waits for it
        const handed_off = new Promise<void>((resolve) => {
            child.once("close", () => resolve());
            child.once("error", () => resolve());
            setTimeout(resolve, OPEN_HANDOFF_TIMEOUT_MS);
        });

        this.#pending_opens.add(handed_off);
        handed_off.then(() => this.#pending_opens.delete(handed_off));
    }

    /**
     * Waits for any URLs still being opened to hand off, so exiting doesn't cut them off.
     */
    async wait_for_pending_opens(): Promise<void> {
        await Promise.all(this.#pending_opens);
    }
}
