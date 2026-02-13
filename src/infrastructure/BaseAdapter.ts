export abstract class BaseAdapter {
    // Infrastructure connects the Domain to the world. 🌍
    protected abstract connect(): Promise<void>;
}
