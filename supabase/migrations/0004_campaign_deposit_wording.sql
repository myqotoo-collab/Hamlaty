-- 0004: campaigns never see a "Hamlaty fee". The amount they pay through Hamlaty is the
-- "confirmation deposit", part of the provider's price and deducted from what they owe the provider.
-- Rewrites the payment instructions only if they still hold the default wording from 0003
-- (an admin who already set bank details keeps their text).
update app_settings
set value = jsonb_build_object(
  'ar', 'حوّل عربون تأكيد الحجز إلى حساب حملتي البنكي، ثم أرسل صورة التحويل مع رقم الحجز إلى support@hamlaty.co. يتأكد الحجز فور استلامها، ويُخصم المبلغ مما تدفعه للفندق أو المكتب.',
  'en', 'Transfer the confirmation deposit to Hamlaty''s bank account, then send the transfer receipt with the booking number to support@hamlaty.co. The booking is confirmed as soon as we receive it, and the amount is deducted from what you pay the hotel or office.'
)
where key = 'fee_payment_instructions'
  and value->>'ar' like '%رسوم حملتي%';
