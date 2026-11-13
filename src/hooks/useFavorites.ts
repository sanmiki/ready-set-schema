import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { useSession } from "@/hooks/useSession";
import { listMyFavoriteIds, setFavorite } from "@/lib/favorites.functions";

export const FAVORITE_IDS_KEY = ["favorite-ids"] as const;

// Favorite state for heart buttons. Signed-out visitors are sent to sign in.
export function useFavorites() {
  const { user, ready } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fetchIds = useServerFn(listMyFavoriteIds);
  const save = useServerFn(setFavorite);

  const idsQuery = useQuery({
    queryKey: [...FAVORITE_IDS_KEY, user?.id ?? "anon"],
    queryFn: () => fetchIds(),
    enabled: !!user,
    staleTime: 30_000,
  });
  const ids = new Set(user ? (idsQuery.data ?? []) : []);

  const mutation = useMutation({
    mutationFn: (vars: { productId: string; favorite: boolean }) => save({ data: vars }),
    onMutate: async (vars) => {
      const key = [...FAVORITE_IDS_KEY, user?.id ?? "anon"];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<string[]>(key);
      queryClient.setQueryData<string[]>(key, (current = []) =>
        vars.favorite ? Array.from(new Set([...current, vars.productId])) : current.filter((id) => id !== vars.productId),
      );
      return { previous, key };
    },
    onSuccess: (result, vars, ctx) => {
      if (!result.ok) {
        queryClient.setQueryData(ctx?.key ?? [], ctx?.previous);
        toast.error(result.message);
        return;
      }
      toast.success(vars.favorite ? "დაემატა რჩეულებში" : "წაიშალა რჩეულებიდან");
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) queryClient.setQueryData(ctx.key, ctx.previous);
      toast.error("ოპერაცია ვერ მოხერხდა. სცადეთ თავიდან.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: FAVORITE_IDS_KEY });
      void queryClient.invalidateQueries({ queryKey: ["my-favorites"] });
    },
  });

  function toggle(productId: string) {
    if (!ready) return;
    if (!user) {
      toast("რჩეულებში შესანახად შედით ანგარიშზე");
      navigate({ to: "/auth", search: { redirect: "/favorites" } });
      return;
    }
    mutation.mutate({ productId, favorite: !ids.has(productId) });
  }

  return { isFavorite: (id: string) => ids.has(id), toggle, pending: mutation.isPending };
}
