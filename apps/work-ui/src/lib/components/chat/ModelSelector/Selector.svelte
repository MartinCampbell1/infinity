<script lang="ts">
  import { DropdownMenu } from "bits-ui";
  import { marked } from "marked";
  import Fuse from "fuse.js";

  import dayjs from "$lib/dayjs";
  import relativeTime from "dayjs/plugin/relativeTime";
  dayjs.extend(relativeTime);

  import Spinner from "$lib/components/common/Spinner.svelte";
  import { flyAndScale } from "$lib/utils/transitions";

  import { onMount, getContext, tick } from "svelte";
  import { resolveFounderosEmbeddedAccessToken } from "$lib/founderos/credentials";

  import {
    deleteModel,
    getOllamaVersion,
    pullModel,
    unloadModel,
  } from "$lib/apis/ollama";

  import {
    user,
    MODEL_DOWNLOAD_POOL,
    models,
    mobile,
    settings,
    config,
  } from "$lib/stores";
  import { toast } from "svelte-sonner";
  import { sanitizeResponseContent, splitStream } from "$lib/utils";
  import { getModels } from "$lib/apis";

  import ChevronDown from "$lib/components/icons/ChevronDown.svelte";
  import Search from "$lib/components/icons/Search.svelte";
  import Tooltip from "$lib/components/common/Tooltip.svelte";

  import type { I18nStore } from "$lib/i18n";
  import type { Model } from "$lib/stores";

  import ModelItem from "./ModelItem.svelte";

  type ModelSelectorModel = Model & {
    preset?: boolean;
    direct?: boolean;
    connection_type?: "local" | "external" | string;
    tags?: Array<{ name: string }>;
    info?:
      | (NonNullable<Model["info"]> & {
          base_model_id?: string | null;
          user_id?: string | null;
          meta?: NonNullable<NonNullable<Model["info"]>["meta"]> & {
            hidden?: boolean;
          };
        })
      | null;
    ollama?: {
      details?: {
        parameter_size?: string;
        quantization_level?: string;
      };
      size?: number;
      expires_at?: number;
    };
  };

  type ModelSelectorItem = {
    label: string;
    value: string;
    model: ModelSelectorModel;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };

  type SearchableModelSelectorItem = ModelSelectorItem & {
    modelName?: string;
    tags: string;
    desc?: string;
  };

  type ConnectionType = "" | "local" | "external" | "direct";

  type DownloadEntry = {
    abortController?: AbortController | null;
    reader?: ReadableStreamDefaultReader<string> | null;
    done?: boolean;
    pullProgress?: number;
    digest?: string;
  };

  type DownloadPool = Record<string, DownloadEntry>;

  type OllamaPullEvent = {
    error?: string;
    detail?: string;
    status?: string;
    digest?: string;
    completed?: number;
    total?: number;
  };

  const i18n = getContext<I18nStore>("i18n");
  export let id = "";
  export let value = "";
  export let placeholder = $i18n.t("Select a model");
  export let searchEnabled = true;
  export let searchPlaceholder = $i18n.t("Search a model");

  export let items: ModelSelectorItem[] = [];

  export let className = "w-[32rem]";
  export let triggerClassName = "text-lg";

  export let pinModelHandler: (modelId: string) => void = () => {};

  let tagsContainerElement: HTMLDivElement | null = null;

  let show = false;
  let tags: string[] = [];

  let selectedModel: ModelSelectorItem | null = null;
  $: selectedModel = items.find((item) => item.value === value) ?? null;

  let searchValue = "";

  let selectedTag = "";
  let selectedConnectionType: ConnectionType = "";

  let ollamaVersion: string | false | null = null;
  let selectedModelIdx = 0;
  let modelDownloadPool: DownloadPool = {};

  $: modelDownloadPool = ($MODEL_DOWNLOAD_POOL ?? {}) as DownloadPool;

  const toSearchableItem = (
    item: ModelSelectorItem,
  ): SearchableModelSelectorItem => ({
    ...item,
    modelName: item.model?.name,
    tags: (item.model?.tags ?? []).map((tag) => tag.name).join(" "),
    desc: item.model?.info?.meta?.description,
  });

  const getDirectConnections = (): object | null =>
    $config?.features?.enable_direct_connections
      ? ($settings?.directConnections ?? null)
      : null;
  const getWorkspaceAuthToken = () => resolveFounderosEmbeddedAccessToken();

  const getPoolEntry = (modelTag: string) => modelDownloadPool[modelTag] ?? {};

  const setDownloadPool = (nextPool: DownloadPool) => {
    modelDownloadPool = nextPool;
    MODEL_DOWNLOAD_POOL.set(nextPool);
  };

  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : `${error}`;

  const fuse = new Fuse<SearchableModelSelectorItem>(
    items.map(toSearchableItem),
    {
      keys: ["value", "tags", "modelName"],
      threshold: 0.4,
    },
  );

  const updateFuse = () => {
    if (fuse) {
      fuse.setCollection(items.map(toSearchableItem));
    }
  };

  $: if (items) {
    updateFuse();
  }

  let filteredItems: SearchableModelSelectorItem[] = [];
  $: filteredItems = (
    searchValue
      ? fuse
          .search(searchValue)
          .map((e) => {
            return e.item;
          })
          .filter((item) => {
            if (selectedTag === "") {
              return true;
            }

            return (item.model?.tags ?? [])
              .map((tag) => tag.name.toLowerCase())
              .includes(selectedTag.toLowerCase());
          })
          .filter((item) => {
            if (selectedConnectionType === "") {
              return true;
            }

            if (selectedConnectionType === "local") {
              return item.model?.connection_type === "local";
            }

            if (selectedConnectionType === "external") {
              return item.model?.connection_type === "external";
            }

            return item.model?.direct ?? false;
          })
      : items
          .map(toSearchableItem)
          .filter((item) => {
            if (selectedTag === "") {
              return true;
            }
            return (item.model?.tags ?? [])
              .map((tag) => tag.name.toLowerCase())
              .includes(selectedTag.toLowerCase());
          })
          .filter((item) => {
            if (selectedConnectionType === "") {
              return true;
            }

            if (selectedConnectionType === "local") {
              return item.model?.connection_type === "local";
            }

            if (selectedConnectionType === "external") {
              return item.model?.connection_type === "external";
            }

            return item.model?.direct ?? false;
          })
  ).filter((item) => !(item.model?.info?.meta?.hidden ?? false));

  $: if (
    selectedTag !== undefined ||
    selectedConnectionType !== undefined ||
    searchValue !== undefined
  ) {
    resetView();
  }

  const resetView = async () => {
    await tick();

    const selectedInFiltered = filteredItems.findIndex(
      (item) => item.value === value,
    );

    if (selectedInFiltered >= 0) {
      // The selected model is visible in the current filter
      selectedModelIdx = selectedInFiltered;
    } else {
      // The selected model is not visible, default to first item in filtered list
      selectedModelIdx = 0;
    }

    // Set the virtual scroll position so the selected item is rendered and centered
    const targetScrollTop = Math.max(
      0,
      selectedModelIdx * ITEM_HEIGHT - 128 + ITEM_HEIGHT / 2,
    );
    listScrollTop = targetScrollTop;

    await tick();

    if (listContainer) {
      listContainer.scrollTop = targetScrollTop;
    }

    await tick();
    const item = document.querySelector(`[data-arrow-selected="true"]`);
    item?.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "instant",
    });
  };

  const pullModelHandler = async () => {
    const sanitizedModelTag = searchValue
      .trim()
      .replace(/^ollama\s+(run|pull)\s+/, "");

    console.log(modelDownloadPool);
    if (modelDownloadPool[sanitizedModelTag]) {
      toast.error(
        $i18n.t(`Model '{{modelTag}}' is already in queue for downloading.`, {
          modelTag: sanitizedModelTag,
        }),
      );
      return;
    }
    if (Object.keys(modelDownloadPool).length === 3) {
      toast.error(
        $i18n.t(
          "Maximum of 3 models can be downloaded simultaneously. Please try again later.",
        ),
      );
      return;
    }

    const [res, controller] = (await pullModel(
      getWorkspaceAuthToken(),
      sanitizedModelTag,
      0,
    ).catch((error: unknown) => {
      toast.error(getErrorMessage(error));
      return [null, null] as const;
    })) as [Response | null, AbortController | null];

    if (res?.body) {
      const reader = res.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(splitStream("\n"))
        .getReader();

      const currentDownloadEntry = getPoolEntry(sanitizedModelTag);

      setDownloadPool({
        ...modelDownloadPool,
        [sanitizedModelTag]: {
          ...currentDownloadEntry,
          abortController: controller,
          reader,
          done: false,
        },
      });

      while (true) {
        try {
          const { value, done } = await reader.read();
          if (done) break;

          let lines = value.split("\n");

          for (const line of lines) {
            if (line !== "") {
              let data = JSON.parse(line) as OllamaPullEvent;
              console.log(data);
              if (data.error) {
                throw data.error;
              }
              if (data.detail) {
                throw data.detail;
              }

              if (data.status) {
                if (data.digest) {
                  let downloadProgress = 0;
                  if (data.completed && data.total) {
                    downloadProgress =
                      Math.round((data.completed / data.total) * 1000) / 10;
                  } else {
                    downloadProgress = 100;
                  }

                  const currentDownloadEntry = getPoolEntry(sanitizedModelTag);

                  setDownloadPool({
                    ...modelDownloadPool,
                    [sanitizedModelTag]: {
                      ...currentDownloadEntry,
                      pullProgress: downloadProgress,
                      digest: data.digest,
                    },
                  });
                } else {
                  toast.success(data.status);

                  const currentDownloadEntry = getPoolEntry(sanitizedModelTag);

                  setDownloadPool({
                    ...modelDownloadPool,
                    [sanitizedModelTag]: {
                      ...currentDownloadEntry,
                      done: data.status === "success",
                    },
                  });
                }
              }
            }
          }
        } catch (error: unknown) {
          console.log(error);
          toast.error(getErrorMessage(error));
          // opts.callback({ success: false, error, modelName: opts.modelName });
          break;
        }
      }

      if (modelDownloadPool[sanitizedModelTag].done) {
        toast.success(
          $i18n.t(`Model '{{modelName}}' has been successfully downloaded.`, {
            modelName: sanitizedModelTag,
          }),
        );

        models.set(
          await getModels(getWorkspaceAuthToken(), getDirectConnections()),
        );
      } else {
        toast.error($i18n.t("Download canceled"));
      }

      const nextPool = { ...modelDownloadPool };
      delete nextPool[sanitizedModelTag];

      setDownloadPool(nextPool);
    } else if (res) {
      toast.error($i18n.t("Download stream was empty"));
    }
  };

  const setOllamaVersion = async () => {
    ollamaVersion = await getOllamaVersion(getWorkspaceAuthToken()).catch(
      (error) => false,
    );
  };

  onMount(async () => {
    if (items) {
      tags = items
        .filter((item) => !(item.model?.info?.meta?.hidden ?? false))
        .flatMap((item) => item.model?.tags ?? [])
        .map((tag) => tag.name.toLowerCase());
      // Remove duplicates and sort
      tags = Array.from(new Set(tags)).sort((a, b) => a.localeCompare(b));
    }
  });

  $: if (show) {
    setOllamaVersion();
  }

  const cancelModelPullHandler = async (model: string) => {
    const { reader, abortController } = modelDownloadPool[model];
    if (abortController) {
      abortController.abort();
    }
    if (reader) {
      await reader.cancel();
      const nextPool = { ...modelDownloadPool };
      delete nextPool[model];
      setDownloadPool(nextPool);
      await deleteModel(getWorkspaceAuthToken(), model);
      toast.success(
        $i18n.t("{{model}} download has been canceled", { model: model }),
      );
    }
  };

  const unloadModelHandler = async (model: string) => {
    const res = await unloadModel(getWorkspaceAuthToken(), model).catch((error) => {
      toast.error($i18n.t("Error unloading model: {{error}}", { error }));
    });

    if (res) {
      toast.success($i18n.t("Model unloaded successfully"));
      models.set(
        await getModels(getWorkspaceAuthToken(), getDirectConnections()),
      );
    }
  };

  const ITEM_HEIGHT = 42;
  const OVERSCAN = 10;

  let listScrollTop = 0;
  let listContainer: HTMLDivElement | null = null;

  $: visibleStart = Math.max(
    0,
    Math.floor(listScrollTop / ITEM_HEIGHT) - OVERSCAN,
  );
  $: visibleEnd = Math.min(
    filteredItems.length,
    Math.ceil((listScrollTop + 256) / ITEM_HEIGHT) + OVERSCAN,
  );
</script>

<DropdownMenu.Root
  bind:open={show}
  onOpenChange={async () => {
    searchValue = "";
    listScrollTop = 0;
    window.setTimeout(
      () => document.getElementById("model-search-input")?.focus(),
      0,
    );

    resetView();
  }}
  onOpenChangeComplete={(open) => {
    if (!open) {
      // Replaces the old closeFocus={false} behavior - prevent focus jump back to trigger
      document.getElementById(`model-selector-${id}-button`)?.blur();
    }
  }}
>
  <DropdownMenu.Trigger
    class="relative w-full {($settings?.highContrastMode ?? false)
      ? ''
      : 'outline-hidden focus:outline-hidden'}"
    aria-label={selectedModel
      ? $i18n.t("Selected model: {{modelName}}", {
          modelName: selectedModel.label,
        })
      : placeholder}
    id="model-selector-{id}-button"
  >
    <div
      role="button"
      tabindex="0"
      class="flex w-full text-left px-0.5 bg-transparent truncate {triggerClassName} justify-between {($settings?.highContrastMode ??
      false)
        ? 'dark:placeholder-gray-100 placeholder-gray-800'
        : 'placeholder-gray-400'}"
      on:mouseenter={async () => {
        models.set(
          await getModels(getWorkspaceAuthToken(), getDirectConnections()),
        );
      }}
    >
      {#if selectedModel}
        {selectedModel.label}
      {:else}
        {placeholder}
      {/if}
      <ChevronDown className=" self-center ml-2 size-3" strokeWidth="2.5" />
    </div>
  </DropdownMenu.Trigger>

  <DropdownMenu.Portal>
    <DropdownMenu.Content
      forceMount
      trapFocus={false}
      preventScroll={false}
      side="bottom"
      align={$mobile ? "center" : "start"}
      sideOffset={2}
      alignOffset={-1}
    >
      {#snippet child({ wrapperProps, props, open })}
        {#if open}
          <div {...wrapperProps}>
            <div
              {...props}
              class="{props.class} z-40 {$mobile
                ? `w-full`
                : `${className}`} max-w-[calc(100vw-1rem)] justify-start rounded-2xl bg-white dark:bg-gray-850 dark:text-white shadow-lg outline-hidden"
              transition:flyAndScale
            >
              <slot>
                {#if searchEnabled}
                  <div class="flex items-center gap-2.5 px-4.5 pt-3.5 mb-1.5">
                    <Search className="size-4" strokeWidth="2.5" />

                    <input
                      id="model-search-input"
                      bind:value={searchValue}
                      class="w-full text-sm bg-transparent outline-hidden"
                      placeholder={searchPlaceholder}
                      autocomplete="off"
                      aria-label={$i18n.t("Search In Models")}
                      on:keydown={(e) => {
                        if (e.code === "Enter" && filteredItems.length > 0) {
                          value = filteredItems[selectedModelIdx].value;
                          show = false;
                          return; // dont need to scroll on selection
                        } else if (e.code === "ArrowDown") {
                          e.stopPropagation();
                          selectedModelIdx = Math.min(
                            selectedModelIdx + 1,
                            filteredItems.length - 1,
                          );
                        } else if (e.code === "ArrowUp") {
                          e.stopPropagation();
                          selectedModelIdx = Math.max(selectedModelIdx - 1, 0);
                        } else {
                          // if the user types something, reset to the top selection.
                          selectedModelIdx = 0;
                        }

                        const item = document.querySelector(
                          `[data-arrow-selected="true"]`,
                        );
                        item?.scrollIntoView({
                          block: "center",
                          inline: "nearest",
                          behavior: "instant",
                        });
                      }}
                    />
                  </div>
                {/if}

                <div class="px-2">
                  {#if tags && items.filter((item) => !(item.model?.info?.meta?.hidden ?? false)).length > 0}
                    <div
                      class=" flex w-full bg-white dark:bg-gray-850 overflow-x-auto scrollbar-none font-[450] mb-0.5"
                      on:wheel={(e) => {
                        if (e.deltaY !== 0) {
                          e.preventDefault();
                          if (e.currentTarget instanceof HTMLElement) {
                            e.currentTarget.scrollLeft += e.deltaY;
                          }
                        }
                      }}
                    >
                      <div
                        class="flex gap-1 w-fit text-center text-sm rounded-full bg-transparent px-1.5 whitespace-nowrap"
                        bind:this={tagsContainerElement}
                      >
                        {#if items.find((item) => item.model?.connection_type === "local") || items.find((item) => item.model?.connection_type === "external") || items.find((item) => item.model?.direct) || tags.length > 0}
                          <button
                            class="min-w-fit outline-none px-1.5 py-0.5 {selectedTag ===
                              '' && selectedConnectionType === ''
                              ? ''
                              : 'text-gray-300 dark:text-gray-600 hover:text-gray-700 dark:hover:text-white'} transition capitalize"
                            aria-pressed={selectedTag === "" &&
                              selectedConnectionType === ""}
                            on:click={() => {
                              selectedConnectionType = "";
                              selectedTag = "";
                            }}
                          >
                            {$i18n.t("All")}
                          </button>
                        {/if}

                        {#if items.find((item) => item.model?.connection_type === "local")}
                          <button
                            class="min-w-fit outline-none px-1.5 py-0.5 {selectedConnectionType ===
                            'local'
                              ? ''
                              : 'text-gray-300 dark:text-gray-600 hover:text-gray-700 dark:hover:text-white'} transition capitalize"
                            aria-pressed={selectedConnectionType === "local"}
                            on:click={() => {
                              selectedTag = "";
                              selectedConnectionType = "local";
                            }}
                          >
                            {$i18n.t("Local")}
                          </button>
                        {/if}

                        {#if items.find((item) => item.model?.connection_type === "external")}
                          <button
                            class="min-w-fit outline-none px-1.5 py-0.5 {selectedConnectionType ===
                            'external'
                              ? ''
                              : 'text-gray-300 dark:text-gray-600 hover:text-gray-700 dark:hover:text-white'} transition capitalize"
                            aria-pressed={selectedConnectionType === "external"}
                            on:click={() => {
                              selectedTag = "";
                              selectedConnectionType = "external";
                            }}
                          >
                            {$i18n.t("External")}
                          </button>
                        {/if}

                        {#if items.find((item) => item.model?.direct)}
                          <button
                            class="min-w-fit outline-none px-1.5 py-0.5 {selectedConnectionType ===
                            'direct'
                              ? ''
                              : 'text-gray-300 dark:text-gray-600 hover:text-gray-700 dark:hover:text-white'} transition capitalize"
                            aria-pressed={selectedConnectionType === "direct"}
                            on:click={() => {
                              selectedTag = "";
                              selectedConnectionType = "direct";
                            }}
                          >
                            {$i18n.t("Direct")}
                          </button>
                        {/if}

                        {#each tags as tag}
                          <Tooltip content={tag}>
                            <button
                              class="min-w-fit outline-none px-1.5 py-0.5 {selectedTag ===
                              tag
                                ? ''
                                : 'text-gray-300 dark:text-gray-600 hover:text-gray-700 dark:hover:text-white'} transition capitalize"
                              aria-pressed={selectedTag === tag}
                              on:click={() => {
                                selectedConnectionType = "";
                                selectedTag = tag;
                              }}
                            >
                              {tag.length > 16 ? `${tag.slice(0, 16)}...` : tag}
                            </button>
                          </Tooltip>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>

                <div class="px-2.5 group relative">
                  {#if filteredItems.length === 0}
                    {#if items.length === 0 && $user?.role === "admin"}
                      <div
                        class="flex flex-col items-start justify-center py-6 px-4 text-start"
                      >
                        <div
                          class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1"
                        >
                          {$i18n.t("No models available")}
                        </div>
                        <div
                          class="text-xs text-gray-500 dark:text-gray-400 mb-4"
                        >
                          {$i18n.t(
                            "Connect to an AI provider to start chatting",
                          )}
                        </div>
                        <a
                          href="/admin/settings/connections"
                          class="px-4 py-1.5 rounded-xl text-xs font-medium bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition"
                          on:click={() => {
                            show = false;
                          }}
                        >
                          {$i18n.t("Manage Connections")}
                        </a>
                      </div>
                    {:else}
                      <div class="">
                        <div
                          class="block px-3 py-2 text-sm text-gray-700 dark:text-gray-100"
                        >
                          {$i18n.t("No results found")}
                        </div>
                      </div>
                    {/if}
                  {:else}
                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                    <div
                      class="max-h-64 overflow-y-auto"
                      role="listbox"
                      aria-label={$i18n.t("Available models")}
                      bind:this={listContainer}
                      on:scroll={() => {
                        if (listContainer) {
                          listScrollTop = listContainer.scrollTop;
                        }
                      }}
                    >
                      <div
                        style="height: {visibleStart * ITEM_HEIGHT}px;"
                      ></div>
                      {#each filteredItems.slice(visibleStart, visibleEnd) as item, i (item.value)}
                        {@const index = visibleStart + i}
                        <ModelItem
                          {selectedModelIdx}
                          {item}
                          {index}
                          {value}
                          {pinModelHandler}
                          {unloadModelHandler}
                          onClick={() => {
                            value = item.value;
                            selectedModelIdx = index;

                            show = false;
                          }}
                        />
                      {/each}
                      <div
                        style="height: {(filteredItems.length - visibleEnd) *
                          ITEM_HEIGHT}px;"
                      ></div>
                    </div>
                  {/if}

                  {#if !(searchValue.trim() in modelDownloadPool) && searchValue && ollamaVersion && $user?.role === "admin"}
                    <Tooltip
                      content={$i18n.t(
                        `Pull "{{searchValue}}" from Ollama.com`,
                        {
                          searchValue: searchValue,
                        },
                      )}
                      placement="top-start"
                    >
                      <button
                        class="flex w-full font-medium line-clamp-1 select-none items-center rounded-button py-2 pl-3 pr-1.5 text-sm text-gray-700 dark:text-gray-100 outline-hidden transition-all duration-75 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer data-highlighted:bg-muted"
                        on:click={() => {
                          pullModelHandler();
                        }}
                      >
                        <div class=" truncate">
                          {$i18n.t(`Pull "{{searchValue}}" from Ollama.com`, {
                            searchValue: searchValue,
                          })}
                        </div>
                      </button>
                    </Tooltip>
                  {/if}

                  {#each Object.keys(modelDownloadPool) as model}
                    <div
                      class="flex w-full justify-between font-medium select-none rounded-button py-2 pl-3 pr-1.5 text-sm text-gray-700 dark:text-gray-100 outline-hidden transition-all duration-75 rounded-xl cursor-pointer data-highlighted:bg-muted"
                    >
                      <div class="flex">
                        <div class="mr-2.5 translate-y-0.5">
                          <Spinner />
                        </div>

                        <div class="flex flex-col self-start">
                          <div class="flex gap-1">
                            <div class="line-clamp-1">
                              Downloading "{model}"
                            </div>

                            <div class="shrink-0">
                              {"pullProgress" in modelDownloadPool[model]
                                ? `(${modelDownloadPool[model].pullProgress}%)`
                                : ""}
                            </div>
                          </div>

                          {#if "digest" in modelDownloadPool[model] && modelDownloadPool[model].digest}
                            <div
                              class="-mt-1 h-fit text-[0.7rem] dark:text-gray-500 line-clamp-1"
                            >
                              {modelDownloadPool[model].digest}
                            </div>
                          {/if}
                        </div>
                      </div>

                      <div class="mr-2 ml-1 translate-y-0.5">
                        <Tooltip content={$i18n.t("Cancel")}>
                          <button
                            class="text-gray-800 dark:text-gray-100"
                            aria-label={$i18n.t(
                              "Cancel download of {{model}}",
                              { model: model },
                            )}
                            on:click={() => {
                              cancelModelPullHandler(model);
                            }}
                          >
                            <svg
                              class="w-4 h-4 text-gray-800 dark:text-white"
                              aria-hidden="true"
                              xmlns="http://www.w3.org/2000/svg"
                              width="24"
                              height="24"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke="currentColor"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M6 18 17.94 6M18 18 6.06 6"
                              />
                            </svg>
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  {/each}
                </div>

                <div class="pb-2.5"></div>

                <div class="hidden w-[42rem]"></div>
                <div class="hidden w-[32rem]"></div>
              </slot>
            </div>
          </div>
        {/if}
      {/snippet}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
