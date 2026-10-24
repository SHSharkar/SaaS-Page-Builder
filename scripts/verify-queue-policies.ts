import { QUEUE_POLICY_MAP } from "../app/server/jobs";
import { JOB_KINDS } from "../lib/enums";
import {
  type CheckResult,
  failCheck,
  passCheck,
  runCliCheck,
} from "./lib/check";

export function verifyQueuePolicies(): CheckResult {
  const failures: string[] = [];

  for (const kind of JOB_KINDS) {
    const policy = QUEUE_POLICY_MAP[kind];
    if (!policy) {
      failures.push(`Missing queue policy for job kind "${kind}"`);
      continue;
    }
    if (policy.deadLetter !== `${kind}.dlq`) {
      failures.push(`${kind}: deadLetter must equal "${kind}.dlq"`);
    }
    if (policy.retryLimit < 1) {
      failures.push(`${kind}: retryLimit must be >= 1`);
    }
    if (!policy.retryBackoff) {
      failures.push(`${kind}: retryBackoff must be true`);
    }
    if (policy.expireInSeconds <= 0 || policy.retentionSeconds <= 0) {
      failures.push(
        `${kind}: expireInSeconds and retentionSeconds must be > 0`,
      );
    }
  }

  return failures.length === 0
    ? passCheck(
        "verify:queue-policies",
        `Verified DLQ, backoff, expiry, and retention policies for all ${JOB_KINDS.length} job kinds`,
      )
    : failCheck(
        "verify:queue-policies",
        "Queue policy verification failed",
        failures,
      );
}

void runCliCheck(import.meta.url, () => verifyQueuePolicies());
