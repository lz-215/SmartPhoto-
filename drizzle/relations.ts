import { relations } from "drizzle-orm/relations";
import { user, session, twoFactor, account, uploads, polarSubscription, polarCustomer, imageEditTasks, imageEditResults } from "./schema";

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	sessions: many(session),
	twoFactors: many(twoFactor),
	accounts: many(account),
	uploads: many(uploads),
	polarSubscriptions: many(polarSubscription),
	polarCustomers: many(polarCustomer),
	imageEditTasks: many(imageEditTasks),
}));

export const twoFactorRelations = relations(twoFactor, ({one}) => ({
	user: one(user, {
		fields: [twoFactor.userId],
		references: [user.id]
	}),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const uploadsRelations = relations(uploads, ({one, many}) => ({
	user: one(user, {
		fields: [uploads.userId],
		references: [user.id]
	}),
	imageEditTasks: many(imageEditTasks),
	imageEditResults: many(imageEditResults),
}));

export const polarSubscriptionRelations = relations(polarSubscription, ({one}) => ({
	user: one(user, {
		fields: [polarSubscription.userId],
		references: [user.id]
	}),
}));

export const polarCustomerRelations = relations(polarCustomer, ({one}) => ({
	user: one(user, {
		fields: [polarCustomer.userId],
		references: [user.id]
	}),
}));

export const imageEditTasksRelations = relations(imageEditTasks, ({one, many}) => ({
	upload: one(uploads, {
		fields: [imageEditTasks.originalImageId],
		references: [uploads.id]
	}),
	user: one(user, {
		fields: [imageEditTasks.userId],
		references: [user.id]
	}),
	imageEditResults: many(imageEditResults),
}));

export const imageEditResultsRelations = relations(imageEditResults, ({one}) => ({
	upload: one(uploads, {
		fields: [imageEditResults.savedImageId],
		references: [uploads.id]
	}),
	imageEditTask: one(imageEditTasks, {
		fields: [imageEditResults.taskId],
		references: [imageEditTasks.id]
	}),
}));