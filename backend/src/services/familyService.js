'use strict';

const { pool } = require('../config/db');
const familyRepository = require('../repositories/familyRepository');
const familyMemberRepository = require('../repositories/familyMemberRepository');
const ApiError = require('../utils/ApiError');

async function getFamilies(query) {
  return await familyRepository.list(query);
}

async function getFamilyDetail(id, scope = {}) {
  const family = await familyRepository.findById(id, scope);
  if (!family) {
    throw ApiError.notFound('Family record not found');
  }

  const members = await familyMemberRepository.listByFamilyId(id);
  const events = await familyMemberRepository.getFamilyEvents(id);

  return {
    ...family,
    members,
    events,
  };
}

async function getNextCode(churchId) {
  return await familyRepository.getNextFamilyCode(churchId);
}

async function createFamily(data, user) {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    let familyCode = data.family_code;
    if (!familyCode) {
      familyCode = await familyRepository.getNextFamilyCode(data.church_id, conn);
    }

    const familyId = await familyRepository.create(
      {
        ...data,
        family_code: familyCode,
        created_by: user.id,
      },
      conn
    );

    let headId = null;

    // If initial head member or members provided
    if (data.head_member) {
      headId = await familyMemberRepository.create(
        {
          ...data.head_member,
          church_id: data.church_id,
          family_id: familyId,
          is_head: 1,
          relationship_to_head: 'HEAD',
          created_by: user.id,
        },
        conn
      );

      // Link head_member_id on family
      await conn.query('UPDATE families SET head_member_id = ? WHERE id = ?', [headId, familyId]);
    }

    // If additional members provided
    if (Array.isArray(data.members) && data.members.length > 0) {
      for (const m of data.members) {
        await familyMemberRepository.create(
          {
            ...m,
            church_id: data.church_id,
            family_id: familyId,
            is_head: 0,
            created_by: user.id,
          },
          conn
        );
      }
    }

    // Log creation event
    await familyMemberRepository.logEvent(
      data.church_id,
      familyId,
      headId,
      'CREATED',
      `Family "${data.family_name}" (${familyCode}) created`,
      { initialMemberCount: (data.members?.length || 0) + (data.head_member ? 1 : 0) },
      user.id,
      conn
    );

    await conn.commit();
    return await getFamilyDetail(familyId, { churchId: data.church_id });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function updateFamily(id, data, user) {
  const existing = await familyRepository.findById(id, { churchId: data.church_id });
  if (!existing) {
    throw ApiError.notFound('Family record not found');
  }

  await familyRepository.update(id, { ...data, updated_by: user.id });

  await familyMemberRepository.logEvent(
    existing.church_id,
    id,
    null,
    'STATUS_CHANGED',
    `Family information updated`,
    { updatedFields: Object.keys(data) },
    user.id
  );

  return await getFamilyDetail(id, { churchId: existing.church_id });
}

async function deleteFamily(id, user, scope = {}) {
  const existing = await familyRepository.findById(id, scope);
  if (!existing) {
    throw ApiError.notFound('Family record not found');
  }

  await familyRepository.softDelete(id, user.id);
  await familyMemberRepository.logEvent(
    existing.church_id,
    id,
    null,
    'STATUS_CHANGED',
    `Family removed from parish register`,
    null,
    user.id
  );

  return { success: true };
}

async function addMember(familyId, memberData, user) {
  const family = await familyRepository.findById(familyId, { churchId: memberData.church_id });
  if (!family) {
    throw ApiError.notFound('Family not found');
  }

  const memberId = await familyMemberRepository.create(
    {
      ...memberData,
      church_id: family.church_id,
      family_id: familyId,
      created_by: user.id,
    },
    pool
  );

  // If set as head, update family.head_member_id and unset old head
  if (memberData.is_head) {
    await pool.query('UPDATE family_members SET is_head = 0 WHERE family_id = ? AND id != ?', [familyId, memberId]);
    await pool.query('UPDATE families SET head_member_id = ? WHERE id = ?', [memberId, familyId]);
  }

  await familyMemberRepository.logEvent(
    family.church_id,
    familyId,
    memberId,
    'MEMBER_ADDED',
    `Member ${memberData.first_name} ${memberData.last_name || ''} added as ${memberData.relationship_to_head || 'Member'}`,
    memberData,
    user.id
  );

  return await familyMemberRepository.findById(memberId);
}

async function updateMember(memberId, memberData, user) {
  const member = await familyMemberRepository.findById(memberId);
  if (!member) {
    throw ApiError.notFound('Member not found');
  }

  await familyMemberRepository.update(memberId, { ...memberData, updated_by: user.id });

  if (memberData.is_head && !member.is_head) {
    await pool.query('UPDATE family_members SET is_head = 0 WHERE family_id = ? AND id != ?', [member.family_id, memberId]);
    await pool.query('UPDATE families SET head_member_id = ? WHERE id = ?', [memberId, member.family_id]);
    await familyMemberRepository.logEvent(
      member.church_id,
      member.family_id,
      memberId,
      'HEAD_CHANGED',
      `${memberData.first_name || member.first_name} appointed as Family Head`,
      null,
      user.id
    );
  }

  await familyMemberRepository.logEvent(
    member.church_id,
    member.family_id,
    memberId,
    'MEMBER_UPDATED',
    `Updated details for ${member.first_name} ${member.last_name || ''}`,
    null,
    user.id
  );

  return await familyMemberRepository.findById(memberId);
}

async function removeMember(memberId, user) {
  const member = await familyMemberRepository.findById(memberId);
  if (!member) {
    throw ApiError.notFound('Member not found');
  }

  await familyMemberRepository.softDelete(memberId, user.id);

  // If this member was the head, clear head_member_id
  if (member.is_head) {
    await pool.query('UPDATE families SET head_member_id = NULL WHERE id = ?', [member.family_id]);
  }

  await familyMemberRepository.logEvent(
    member.church_id,
    member.family_id,
    memberId,
    'MEMBER_REMOVED',
    `Member ${member.first_name} ${member.last_name || ''} removed from family`,
    null,
    user.id
  );

  return { success: true };
}

/**
 * Split Family:
 * Moves selected members from an existing (parent) family into a newly created family.
 * Links parent_family_id for genealogical/parish tracing.
 */
async function splitFamily(parentFamilyId, splitData, user) {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const parent = await familyRepository.findById(parentFamilyId, { churchId: splitData.church_id }, conn);
    if (!parent) {
      throw ApiError.notFound('Parent family not found');
    }

    if (!Array.isArray(splitData.member_ids) || splitData.member_ids.length === 0) {
      throw ApiError.badRequest('Must select at least one member to split into the new family');
    }

    let newCode = splitData.family_code;
    if (!newCode) {
      newCode = await familyRepository.getNextFamilyCode(parent.church_id, conn);
    }

    // 1. Create the new family
    const newFamilyId = await familyRepository.create(
      {
        church_id: parent.church_id,
        branch_id: splitData.branch_id || parent.branch_id,
        family_code: newCode,
        family_name: splitData.family_name,
        family_name_ta: splitData.family_name_ta || null,
        ward_id: splitData.ward_id || parent.ward_id,
        parent_family_id: parentFamilyId,
        address_line1: splitData.address_line1 || parent.address_line1,
        address_line2: splitData.address_line2 || parent.address_line2,
        address_ta: splitData.address_ta || parent.address_ta,
        city: splitData.city || parent.city,
        pincode: splitData.pincode || parent.pincode,
        phone: splitData.phone || null,
        email: splitData.email || null,
        marriage_date: splitData.marriage_date || null,
        status: 'ACTIVE',
        remarks: splitData.remarks || `Divided / Split from ${parent.family_name} (${parent.family_code})`,
        created_by: user.id,
      },
      conn
    );

    // 2. Re-assign selected members to the new family
    const newHeadMemberId = splitData.head_member_id || splitData.member_ids[0];

    for (const memId of splitData.member_ids) {
      const isHead = memId === newHeadMemberId ? 1 : 0;
      const rel = isHead ? 'HEAD' : (splitData.member_relationships?.[memId] || 'OTHER');

      await familyMemberRepository.moveToFamily(memId, newFamilyId, rel, isHead, conn);
    }

    // 3. Set the head on the new family
    await conn.query('UPDATE families SET head_member_id = ? WHERE id = ?', [newHeadMemberId, newFamilyId]);

    // 4. If parent family's head was moved away, clear parent's head_member_id
    if (splitData.member_ids.includes(parent.head_member_id)) {
      await conn.query('UPDATE families SET head_member_id = NULL WHERE id = ?', [parentFamilyId]);
    }

    // 5. Log events on both parent and new family
    await familyMemberRepository.logEvent(
      parent.church_id,
      parentFamilyId,
      newHeadMemberId,
      'FAMILY_SPLIT',
      `Family divided: ${splitData.member_ids.length} member(s) branched off into new household "${splitData.family_name}" (${newCode})`,
      { newFamilyId, newFamilyCode: newCode, memberIds: splitData.member_ids },
      user.id,
      conn
    );

    await familyMemberRepository.logEvent(
      parent.church_id,
      newFamilyId,
      newHeadMemberId,
      'CREATED',
      `New family created via split from ${parent.family_name} (${parent.family_code})`,
      { parentFamilyId, parentFamilyCode: parent.family_code },
      user.id,
      conn
    );

    await conn.commit();
    return await getFamilyDetail(newFamilyId, { churchId: parent.church_id });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Migrate Family (Transfer In / Out):
 */
async function migrateFamily(familyId, migrationData, user) {
  const family = await familyRepository.findById(familyId, { churchId: migrationData.church_id });
  if (!family) {
    throw ApiError.notFound('Family not found');
  }

  const newStatus = migrationData.status || (migrationData.direction === 'IN' ? 'MIGRATED_IN' : 'MIGRATED_OUT');

  await familyRepository.update(
    familyId,
    {
      status: newStatus,
      migration_date: migrationData.migration_date || new Date().toISOString().split('T')[0],
      migration_reason: migrationData.migration_reason || null,
      migrated_to_parish: migrationData.migrated_to_parish || null,
      migrated_from_parish: migrationData.migrated_from_parish || null,
      remarks: migrationData.remarks || family.remarks,
      updated_by: user.id,
    },
    pool
  );

  const eventType = newStatus === 'MIGRATED_IN' ? 'MIGRATED_IN' : 'MIGRATED_OUT';
  const desc =
    newStatus === 'MIGRATED_IN'
      ? `Family migrated in from ${migrationData.migrated_from_parish || 'another parish'}`
      : `Family migrated out to ${migrationData.migrated_to_parish || 'another parish/location'}`;

  await familyMemberRepository.logEvent(
    family.church_id,
    familyId,
    null,
    eventType,
    desc,
    migrationData,
    user.id
  );

  return await getFamilyDetail(familyId, { churchId: family.church_id });
}

async function getCensus(churchId, branchId) {
  return await familyRepository.getCensusStats(churchId, branchId);
}

module.exports = {
  getFamilies,
  getFamilyDetail,
  getNextCode,
  createFamily,
  updateFamily,
  deleteFamily,
  addMember,
  updateMember,
  removeMember,
  splitFamily,
  migrateFamily,
  getCensus,
};
