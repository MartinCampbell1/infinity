export {
  buildWorkspaceLaunchSessionContext,
  buildWorkspaceLaunchViewModelForSession,
  buildWorkspaceLaunchViewModelFromState,
  readWorkspaceLaunchSessionContext,
} from "./session-context";
import {
  buildWorkspaceLaunchSessionContext,
  buildWorkspaceLaunchViewModelForSession,
} from "./session-context";

export const buildMockWorkspaceLaunchSessionContext =
  buildWorkspaceLaunchSessionContext;

export const buildMockWorkspaceLaunchViewModel =
  buildWorkspaceLaunchViewModelForSession;
