/**
 * Contact List Service
 *
 * Database operations for managing reusable contact lists.
 *
 * @module services/contact-list
 */

import { query, getClient } from "@/lib/db";

// ============================================
// TYPES
// ============================================

export interface ContactList {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  total_contacts: number;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ContactListItem {
  id: string;
  contact_list_id: string;
  phone_number: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  custom_data: Record<string, unknown>;
  created_at: Date;
}

export interface CreateContactListInput {
  name: string;
  description?: string;
}

export interface UpdateContactListInput {
  name?: string;
  description?: string;
}

export interface CreateContactListItemInput {
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  customData?: Record<string, unknown>;
}

export interface ContactListFilters {
  search?: string;
}

export interface ContactItemFilters {
  search?: string;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  order?: "asc" | "desc";
}

// ============================================
// CONTACT LIST OPERATIONS
// ============================================

/**
 * Create a new contact list
 */
export async function createContactList(
  organizationId: string,
  userId: string,
  input: CreateContactListInput
): Promise<ContactList> {
  const result = await query<ContactList>(
    `INSERT INTO contact_lists (organization_id, name, description, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [organizationId, input.name, input.description || null, userId]
  );

  return result.rows[0];
}

/**
 * Get a contact list by ID
 */
export async function getContactListById(
  listId: string,
  organizationId: string
): Promise<ContactList | null> {
  const result = await query<ContactList>(
    `SELECT * FROM contact_lists
     WHERE id = $1 AND organization_id = $2`,
    [listId, organizationId]
  );

  return result.rows[0] || null;
}

/**
 * Get contact lists by organization with filters
 */
export async function getContactListsByOrganization(
  organizationId: string,
  filters: ContactListFilters = {},
  pagination: PaginationOptions = {}
): Promise<{ lists: ContactList[]; total: number }> {
  const {
    limit = 20,
    offset = 0,
    orderBy = "created_at",
    order = "desc",
  } = pagination;

  const whereClauses = ["organization_id = $1"];
  const values: unknown[] = [organizationId];
  let paramIndex = 2;

  if (filters.search) {
    whereClauses.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
    values.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = whereClauses.join(" AND ");

  // Get total count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) FROM contact_lists WHERE ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get lists
  const validOrderColumns = ["created_at", "updated_at", "name", "total_contacts"];
  const safeOrderBy = validOrderColumns.includes(orderBy) ? orderBy : "created_at";
  const safeOrder = order === "asc" ? "ASC" : "DESC";

  const result = await query<ContactList>(
    `SELECT * FROM contact_lists
     WHERE ${whereClause}
     ORDER BY ${safeOrderBy} ${safeOrder}
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, limit, offset]
  );

  return {
    lists: result.rows,
    total,
  };
}

/**
 * Update a contact list
 */
export async function updateContactList(
  listId: string,
  organizationId: string,
  updates: UpdateContactListInput
): Promise<ContactList | null> {
  const setParts: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setParts.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    setParts.push(`description = $${paramIndex++}`);
    values.push(updates.description);
  }

  if (setParts.length === 0) {
    return getContactListById(listId, organizationId);
  }

  values.push(listId, organizationId);

  const result = await query<ContactList>(
    `UPDATE contact_lists SET ${setParts.join(", ")}
     WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}
     RETURNING *`,
    values
  );

  return result.rows[0] || null;
}

/**
 * Delete a contact list (cascade deletes items)
 */
export async function deleteContactList(
  listId: string,
  organizationId: string
): Promise<boolean> {
  const result = await query(
    `DELETE FROM contact_lists WHERE id = $1 AND organization_id = $2`,
    [listId, organizationId]
  );

  return (result.rowCount ?? 0) > 0;
}

// ============================================
// CONTACT LIST ITEM OPERATIONS
// ============================================

/**
 * Add contacts to a list (bulk insert)
 */
export async function addContactsToList(
  listId: string,
  contacts: CreateContactListItemInput[]
): Promise<number> {
  if (contacts.length === 0) return 0;

  // Build bulk insert
  const valuePlaceholders: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const contact of contacts) {
    valuePlaceholders.push(
      `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
    );
    values.push(
      listId,
      contact.phoneNumber,
      contact.firstName || null,
      contact.lastName || null,
      contact.email || null,
      JSON.stringify(contact.customData || {})
    );
  }

  const result = await query(
    `INSERT INTO contact_list_items (
      contact_list_id, phone_number, first_name, last_name, email, custom_data
    ) VALUES ${valuePlaceholders.join(", ")}
    ON CONFLICT (contact_list_id, phone_number) DO NOTHING`,
    values
  );

  return result.rowCount ?? 0;
}

/**
 * Get contacts from a list with filters
 */
export async function getContactsFromList(
  listId: string,
  filters: ContactItemFilters = {},
  pagination: PaginationOptions = {}
): Promise<{ contacts: ContactListItem[]; total: number }> {
  const {
    limit = 50,
    offset = 0,
    orderBy = "created_at",
    order = "desc",
  } = pagination;

  const whereClauses = ["contact_list_id = $1"];
  const values: unknown[] = [listId];
  let paramIndex = 2;

  if (filters.search) {
    whereClauses.push(
      `(phone_number ILIKE $${paramIndex} OR first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`
    );
    values.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = whereClauses.join(" AND ");

  // Get total count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) FROM contact_list_items WHERE ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get contacts
  const validOrderColumns = ["created_at", "phone_number", "first_name", "last_name"];
  const safeOrderBy = validOrderColumns.includes(orderBy) ? orderBy : "created_at";
  const safeOrder = order === "asc" ? "ASC" : "DESC";

  const result = await query<ContactListItem>(
    `SELECT * FROM contact_list_items
     WHERE ${whereClause}
     ORDER BY ${safeOrderBy} ${safeOrder}
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, limit, offset]
  );

  return {
    contacts: result.rows,
    total,
  };
}

/**
 * Delete a contact from a list
 */
export async function deleteContactFromList(
  contactId: string,
  listId: string
): Promise<boolean> {
  const result = await query(
    `DELETE FROM contact_list_items WHERE id = $1 AND contact_list_id = $2`,
    [contactId, listId]
  );

  return (result.rowCount ?? 0) > 0;
}

/**
 * Delete multiple contacts from a list
 */
export async function deleteContactsFromList(
  contactIds: string[],
  listId: string
): Promise<number> {
  if (contactIds.length === 0) return 0;

  const placeholders = contactIds.map((_, i) => `$${i + 2}`).join(", ");
  const result = await query(
    `DELETE FROM contact_list_items
     WHERE contact_list_id = $1 AND id IN (${placeholders})`,
    [listId, ...contactIds]
  );

  return result.rowCount ?? 0;
}

/**
 * Copy contacts from a list to a campaign
 * Returns the number of contacts copied
 */
export async function copyContactsToCampaign(
  listId: string,
  campaignId: string
): Promise<number> {
  const client = await getClient();

  try {
    await client.query("BEGIN");

    // Insert contacts from list into campaign_contacts
    const result = await client.query(
      `INSERT INTO campaign_contacts (campaign_id, phone_number, first_name, last_name, email, custom_data)
       SELECT $1, phone_number, first_name, last_name, email, custom_data
       FROM contact_list_items
       WHERE contact_list_id = $2
       ON CONFLICT DO NOTHING`,
      [campaignId, listId]
    );

    const insertedCount = result.rowCount ?? 0;

    // Update campaign stats
    if (insertedCount > 0) {
      await client.query(
        `UPDATE campaigns SET
          total_contacts = (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = $1)
         WHERE id = $1`,
        [campaignId]
      );
    }

    await client.query("COMMIT");
    return insertedCount;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
