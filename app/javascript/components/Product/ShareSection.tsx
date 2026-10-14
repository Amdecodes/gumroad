import { Check, ChevronDown, FileDetail, Link, Plus, Share } from "@boxicons/react";
import * as React from "react";

import { Wishlist, addToWishlist, createWishlist } from "$app/data/wishlists";
import { classNames } from "$app/utils/classNames";
import { t } from "$app/utils/i18n";
import { assertResponseError } from "$app/utils/request";

import { Button } from "$app/components/Button";
import { ComboBox } from "$app/components/ComboBox";
import { CopyToClipboard } from "$app/components/CopyToClipboard";
import { useAppDomain } from "$app/components/DomainSettings";
import { FacebookShareButton } from "$app/components/FacebookShareButton";
import { useLoggedInUser } from "$app/components/LoggedInUser";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "$app/components/Popover";
import { Product, WishlistForProduct } from "$app/components/Product";
import { PriceSelection } from "$app/components/Product/ConfigurationSelector";
import { showAlert } from "$app/components/server-components/Alert";
import { TwitterShareButton } from "$app/components/TwitterShareButton";
import { Alert } from "$app/components/ui/Alert";
import { Input } from "$app/components/ui/Input";

type SuccessState = { newlyCreated: boolean; wishlist: Wishlist };

export const ShareSection = ({
  product,
  selection,
  wishlists: initialWishlists,
}: {
  product: Product;
  selection: PriceSelection;
  wishlists: WishlistForProduct[];
}) => {
  const loggedInUser = useLoggedInUser();
  const appDomain = useAppDomain();
  const [wishlists, setWishlists] = React.useState<WishlistForProduct[]>(initialWishlists);
  const [saveState, setSaveState] = React.useState<
    { type: "initial" | "saving" } | ({ type: "success" } & SuccessState)
  >({ type: "initial" });
  const [dropdownState, setDropdownState] = React.useState<
    { state: "closed" } | { state: "open" } | { state: "creating"; newWishlistName: string }
  >({ state: "closed" });

  const isSelectionInWishlist = (wishlist: WishlistForProduct) =>
    wishlist.selections_in_wishlist.some(
      ({ variant_id, recurrence, rent, quantity }) =>
        variant_id === selection.optionId &&
        recurrence === selection.recurrence &&
        rent === selection.rent &&
        quantity === selection.quantity,
    );

  const addProduct = async (resolveWishlist: Promise<SuccessState>) => {
    setSaveState({ type: "saving" });
    setDropdownState({ state: "closed" });

    try {
      const { newlyCreated, wishlist } = await resolveWishlist;
      const { optionId, recurrence, rent, quantity } = selection;

      await addToWishlist({
        wishlistId: wishlist.id,
        productId: product.id,
        optionId,
        recurrence,
        rent,
        quantity,
      });
      setWishlists((wishlists) =>
        wishlists.map((current) =>
          current.id === wishlist.id
            ? {
                ...current,
                selections_in_wishlist: [
                  ...current.selections_in_wishlist,
                  { variant_id: optionId, recurrence, rent, quantity },
                ],
              }
            : current,
        ),
      );
      setSaveState({ type: "success", newlyCreated, wishlist });
    } catch (e) {
      assertResponseError(e);
      showAlert(e.message, "error");
      setSaveState({ type: "initial" });
    }
  };

  const newWishlist = async (name: string): Promise<SuccessState> => {
    const { wishlist } = await createWishlist(name);
    setWishlists([...wishlists, { ...wishlist, selections_in_wishlist: [] }]);
    return { newlyCreated: true, wishlist };
  };

  return (
    <>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <ComboBox
          input={(props) => (
            <div
              {...props}
              className={classNames(
                "flex cursor-pointer items-center rounded border border-border bg-background px-4 py-3",
                dropdownState.state !== "closed" && "rounded-b-none",
              )}
              aria-label={t("storefront.add_to_wishlist")}
            >
              <span className="flex-1 truncate">
                {saveState.type === "success"
                  ? saveState.wishlist.name
                  : saveState.type === "saving"
                    ? t("storefront.adding_to_wishlist")
                    : t("storefront.add_to_wishlist")}
              </span>
              <ChevronDown className="size-5" />
            </div>
          )}
          disabled={saveState.type === "saving"}
          options={[...wishlists, { id: null }]}
          option={(wishlist, props) =>
            wishlist.id ? (
              <div
                {...props}
                inert={isSelectionInWishlist(wishlist)}
                className={classNames(props.className, isSelectionInWishlist(wishlist) ? "opacity-30" : undefined)}
                onClick={(e) => {
                  props.onClick?.(e);
                  void addProduct(Promise.resolve({ newlyCreated: false, wishlist }));
                }}
              >
                <div>
                  <FileDetail className="size-5" /> {wishlist.name}
                </div>
              </div>
            ) : dropdownState.state === "creating" ? (
              <form
                role={props.role}
                className="flex gap-2 p-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!dropdownState.newWishlistName.trim()) {
                    showAlert(t("storefront.please_enter_wishlist_name"), "error");
                    return;
                  }
                  void addProduct(newWishlist(dropdownState.newWishlistName));
                }}
              >
                <Input
                  type="text"
                  autoFocus
                  placeholder={t("storefront.wishlist_name")}
                  value={dropdownState.newWishlistName}
                  onChange={(e) => setDropdownState({ state: "creating", newWishlistName: e.target.value })}
                  aria-label={t("storefront.wishlist_name")}
                />
                <Button type="submit" size="icon" aria-label={t("storefront.create_wishlist")} color="primary">
                  <Check className="size-5" />
                </Button>
              </form>
            ) : (
              <div {...props} onClick={() => setDropdownState({ state: "creating", newWishlistName: "" })}>
                <div>
                  <Plus className="size-5" /> {t("storefront.new_wishlist")}
                </div>
              </div>
            )
          }
          open={loggedInUser ? dropdownState.state !== "closed" : false}
          onToggle={(open) => {
            if (!loggedInUser) {
              window.location.href = Routes.login_url({ host: appDomain, next: product.long_url });
              return;
            }
            if (open) {
              setDropdownState({ state: "open" });
            } else {
              setDropdownState({ state: "closed" });
            }
          }}
        />

        <Popover>
          <PopoverAnchor>
            <PopoverTrigger aria-label={t("storefront.share")} asChild>
              <Button>
                <Share className="size-5" /> {t("storefront.share")}
              </Button>
            </PopoverTrigger>
          </PopoverAnchor>
          <PopoverContent sideOffset={4} onFocusOutside={(e) => e.preventDefault()}>
            <div className="grid grid-cols-1 gap-4">
              <TwitterShareButton url={product.long_url} text={`Buy ${product.name} on @Gumroad`} />
              <FacebookShareButton url={product.long_url} text={product.name} />
              <CopyToClipboard text={product.long_url} copyTooltip={t("storefront.copy_product_url")}>
                <Button aria-label={t("storefront.copy_product_url")}>
                  <Link className="size-5" /> {t("storefront.copy_link")}
                </Button>
              </CopyToClipboard>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {saveState.type === "success" ? (
        <Alert variant="success">
          {saveState.newlyCreated ? (
            <>
              {t("storefront.wishlist_created")} <a href={Routes.wishlists_url()}>{t("storefront.edit_it_here")}</a>
            </>
          ) : (
            t("storefront.added_to_wishlist")
          )}
        </Alert>
      ) : null}
    </>
  );
};
