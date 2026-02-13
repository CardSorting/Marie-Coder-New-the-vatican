export abstract class DomainEntity {
    constructor(public readonly id: string) {}
    // The Domain is pure logic. No dependencies here. ✨
}
