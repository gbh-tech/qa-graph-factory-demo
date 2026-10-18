export class InvalidReportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidReportError';
  }
}

export class DuplicateRunError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateRunError';
  }
}

export class ReportTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportTooLargeError';
  }
}
