"use client";
import React, { memo, useMemo } from "react";
import { useNexus } from "../nexus/NexusProvider";
import { Label } from "../ui/label";
import { DollarSign } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { Separator } from "../ui/separator";
import { cn } from "@/lib/utils";

const UnifiedBalance = ({ className }: { className?: string }) => {
  const { unifiedBalance, nexusSDK } = useNexus();

  const totalFiat = useMemo(() => {
    if (!unifiedBalance) return "0.00";
    const total = unifiedBalance.reduce(
      (acc, fiat) => acc + fiat.balanceInFiat,
      0
    );
    return total.toFixed(2);
  }, [unifiedBalance]);

  const tokens = useMemo(() => {
    return (unifiedBalance ?? []).filter(
      (token) => Number.parseFloat(token.balance) > 0
    );
  }, [unifiedBalance]);

  return (
    <div
      className={cn(
        "w-full max-w-lg mx-auto py-4 px-1 sm:p-4 flex flex-col gap-y-2 items-center overflow-y-scroll max-h-[372px] rounded-lg border border-border",
        className
      )}
    >
      <div className="flex items-center justify-start w-full">
        <Label className="font-semibold text-muted-foreground">
          Total Balance:
        </Label>

        <Label className="text-lg font-bold gap-x-0">
          <DollarSign className="w-4 h-4 font-bold" strokeWidth={3} />
          {totalFiat}
        </Label>
      </div>
      <Accordion type="single" collapsible className="w-full space-y-4">
        {tokens.map((token) => {
          const positiveBreakdown = token.breakdown.filter(
            (chain) => Number.parseFloat(chain.balance) > 0
          );
          const chainsCount = positiveBreakdown.length;
          const chainsLabel =
            chainsCount > 1 ? `${chainsCount} chains` : `${chainsCount} chain`;
          return (
            <AccordionItem
              key={token.symbol}
              value={token.symbol}
              className="px-4"
            >
              <AccordionTrigger
                className="hover:no-underline cursor-pointer items-center"
                hideChevron={false}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex sm:flex-row flex-col items-center gap-3">
                    <div className="relative size-6 sm:size-8">
                      {token.icon && (
                        <img
                          src={token.icon}
                          alt={token.symbol}
                          className="rounded-full size-full"
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold sm:block hidden">
                        {token.symbol}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {chainsLabel}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end">
                      <p className="text-base font-medium">
                        {nexusSDK?.utils?.formatTokenBalance(token.balance, {
                          symbol: token.symbol,
                          decimals: token.decimals,
                        })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ${token.balanceInFiat.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 py-2">
                  {positiveBreakdown.map((chain, index) => (
                    <React.Fragment key={chain.chain.id}>
                      <div className="flex items-center justify-between px-2 py-1 rounded-md">
                        <div className="flex items-center gap-2">
                          <div className="relative size-4  sm:size-6">
                            <img
                              src={chain?.chain?.logo}
                              alt={chain.chain.name}
                              sizes="100%"
                              className="rounded-full size-full"
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                          <span className="text-sm sm:block hidden">
                            {chain.chain.name}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {nexusSDK?.utils?.formatTokenBalance(
                              chain.balance,
                              {
                                symbol: token.symbol,
                                decimals: token.decimals,
                              }
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ${chain.balanceInFiat.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      {index < positiveBreakdown.length - 1 && (
                        <Separator className="my-2" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};
UnifiedBalance.displayName = "UnifiedBalance";
export default memo(UnifiedBalance);
