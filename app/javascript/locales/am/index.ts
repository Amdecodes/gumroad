import { admin } from "./admin";
import { auth } from "./auth";
import { checkout } from "./checkout";
import { actions, common, currency } from "./common";
import { content } from "./content";
import { discover } from "./discover";
import { disputes } from "./disputes";
import { errors } from "./errors";
import { library } from "./library";
import { navigation } from "./navigation";
import { profile } from "./profile";
import { receipt } from "./receipt";
import { seller } from "./seller";
import { storefront } from "./storefront";
import { subscriptions } from "./subscriptions";

export const am = {
  common,
  actions,
  currency,
  checkout,
  receipt,
  storefront,
  subscriptions,
  admin,
  disputes,
  errors,
  discover,
  library,
  content,
  profile,
  seller,
  navigation,
  auth,
} as const;
