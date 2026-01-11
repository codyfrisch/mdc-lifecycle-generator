// Export specific ID types for different Monday.com entities
export {
  mondayGuid as triggerUuid,
  mondayGuid as actionUuid,
  mondaySlug,
  positiveIdSchema as accountId,
  positiveIdSchema as appId,
  positiveIdSchema as platformAppId,
  positiveIdSchema as mondayPositiveId, // Positive only
  positiveIdSchema as recipeId,
  positiveIdSchema as integrationId, // Most permissive
  positiveIdSchema as subscriptionId,
  positiveIdSchema as webhookId,
  signedIdSchema as userId,
  signedIdSchema as mondayId,
  stringPositiveIdSchema as stringAccountId,
  stringPositiveIdSchema as stringAppId,
  stringPositiveIdSchema as stringPlatformAppId,
  stringPositiveIdSchema as stringMondayPositiveId,
  stringPositiveIdSchema as stringRecipeId,
  stringPositiveIdSchema as stringIntegrationId,
  stringPositiveIdSchema as stringSubscriptionId,
  stringPositiveIdSchema as stringBoardId,
  stringSignedIdSchema as stringUserId,
  stringSignedIdSchema as stringMondayId,
} from "./ids-base.js";
