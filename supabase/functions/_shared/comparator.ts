import { ExtractedProperty, ComparisonResult } from "./types.ts";
import { getSupabaseClient } from "./db.ts";

const PRICE_CHANGE_THRESHOLD = 0.01; // 1% change is significant

export async function compareWithDatabase(
  properties: ExtractedProperty[]
): Promise<ComparisonResult> {
  const supabase = getSupabaseClient();
  const result: ComparisonResult = {
    new_properties: [],
    updated_properties: [],
    matched_properties: [],
  };

  for (const property of properties) {
    const nameLower = property.name.toLowerCase().trim();
    const builderName = property.builder_name || "";
    const locality = property.locality || "";

    // Look for existing property by composite key
    const { data: existing } = await supabase
      .from("properties")
      .select("*")
      .eq("name_lower", nameLower)
      .eq("builder_name", builderName || null)
      .eq("locality", locality || null)
      .maybeSingle();

    if (!existing) {
      // Try fuzzy match on name alone
      const { data: fuzzyMatch } = await supabase
        .from("properties")
        .select("*")
        .eq("name_lower", nameLower)
        .maybeSingle();

      if (!fuzzyMatch) {
        result.new_properties.push(property);
      } else {
        // Check for updates
        const changes = detectChanges(fuzzyMatch, property);
        if (Object.keys(changes).length > 0) {
          result.updated_properties.push({
            property,
            matched_id: fuzzyMatch.id,
            changes,
          });
        } else {
          result.matched_properties.push(property);
        }
      }
    } else {
      const changes = detectChanges(existing, property);
      if (Object.keys(changes).length > 0) {
        result.updated_properties.push({
          property,
          matched_id: existing.id,
          changes,
        });
      } else {
        result.matched_properties.push(property);
      }
    }
  }

  return result;
}

function detectChanges(
  existing: Record<string, unknown>,
  incoming: ExtractedProperty
): Record<string, { old: unknown; new: unknown }> {
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  // Check price changes
  if (incoming.price_min && existing.price_min) {
    const priceDiff =
      Math.abs(Number(incoming.price_min) - Number(existing.price_min)) /
      Number(existing.price_min);
    if (priceDiff > PRICE_CHANGE_THRESHOLD) {
      changes.price_min = { old: existing.price_min, new: incoming.price_min };
    }
  }

  if (incoming.price_max && existing.price_max) {
    const priceDiff =
      Math.abs(Number(incoming.price_max) - Number(existing.price_max)) /
      Number(existing.price_max);
    if (priceDiff > PRICE_CHANGE_THRESHOLD) {
      changes.price_max = { old: existing.price_max, new: incoming.price_max };
    }
  }

  // Check status change
  if (incoming.status && existing.status && incoming.status !== existing.status) {
    changes.status = { old: existing.status, new: incoming.status };
  }

  // Check RERA status change
  if (
    incoming.rera_status &&
    existing.rera_status &&
    incoming.rera_status !== existing.rera_status
  ) {
    changes.rera_status = {
      old: existing.rera_status,
      new: incoming.rera_status,
    };
  }

  // Check RERA ID added
  if (incoming.rera_id && !existing.rera_id) {
    changes.rera_id = { old: null, new: incoming.rera_id };
  }

  // Check possession date change
  if (
    incoming.possession_date &&
    existing.possession_date &&
    incoming.possession_date !== existing.possession_date
  ) {
    changes.possession_date = {
      old: existing.possession_date,
      new: incoming.possession_date,
    };
  }

  return changes;
}
