export class DuplicateWordError extends Error {
  constructor() {
    super("To słowo już istnieje w tym słowniku.");
    this.name = "DuplicateWordError";
  }
}

export class DuplicateDictionaryNameError extends Error {
  constructor() {
    super("Słownik o tej nazwie już istnieje.");
    this.name = "DuplicateDictionaryNameError";
  }
}

export class DuplicateSetNameError extends Error {
  constructor() {
    super("Zestaw o tej nazwie już istnieje w tym słowniku.");
    this.name = "DuplicateSetNameError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
