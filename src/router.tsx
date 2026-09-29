import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Preload a route's JS chunk (and loader, if any) the moment the user
    // hovers/focuses/touches a <Link> — by the time they actually click,
    // the page is already fetched, so navigation feels instant instead of
    // waiting on a network round trip after the click.
    defaultPreload: "intent",
  });

  return router;
};
