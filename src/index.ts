import type {Context} from './models';
import type {JSONValue} from './parser';
import {defaultContext, parseContext, parseJsonLogicExpression} from './parser';
import {W} from './w';

export {defaultContext};

/**
 * @beta
 * @param jsonLogic - JsonLogic expression/rule
 * @param data - JsonLogic {@link https://jsonlogic.com/#data-driven | data} object
 * @param context - TypeEnv / Context / Γ , you only need this is you've used {@link https://jsonlogic.com/add_operation.html | add_operation}
 * @returns a description of the
 */
export const infer = (
  jsonLogic: JSONValue,
  data: JSONValue,
  context: Context = defaultContext
): string => {
  const typeenv = parseContext(data, context);
  try {
    const [subsitution, t] = W(...parseJsonLogicExpression(jsonLogic, typeenv));
    const type: string = 'C' in t ? t.C : JSON.stringify([t.a, Object.keys(subsitution.raw)]);
    const ctx: string = JSON.stringify(subsitution.raw);
    return `result type: ${type}\n(intermediate) variables:${ctx}`;
  } catch (error) {
    return error.toString();
  }
};
