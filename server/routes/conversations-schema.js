import z from "zod";

import { conversationIdSchema } from "../../shared/schemas";

export const paramSchema = z.object({ id: conversationIdSchema });
