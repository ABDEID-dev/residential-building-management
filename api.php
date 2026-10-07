<?php
declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=utf-8');

require __DIR__ . '/config.php';

const MONTHLY_FEE = 360.00;

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
    ensureSchema($pdo);

    $action = $_GET['action'] ?? $_POST['action'] ?? '';

    if ($action === 'login') login($pdo);
    elseif ($action === 'logout') logout();
    elseif ($action === 'me') me($pdo);
    elseif ($action === 'data') data($pdo);
    elseif ($action === 'save_profile') saveProfile($pdo);
    elseif ($action === 'create_apartment') createApartment($pdo);
    elseif ($action === 'save_apartment') saveApartment($pdo);
    elseif ($action === 'delete_apartment') deleteApartment($pdo);
    elseif ($action === 'save_admin') saveAdmin($pdo);
    elseif ($action === 'toggle_user') toggleUser($pdo);
    elseif ($action === 'save_payment') savePayment($pdo);
    elseif ($action === 'delete_payment') deletePayment($pdo);
    elseif ($action === 'save_expense') saveExpense($pdo);
    elseif ($action === 'delete_expense') deleteExpense($pdo);
    elseif ($action === 'save_shared_charge') saveSharedCharge($pdo);
    elseif ($action === 'delete_shared_charge') deleteSharedCharge($pdo);
    else respond(['ok' => false, 'message' => 'Unknown action'], 404);
} catch (Throwable $error) {
    respond(['ok' => false, 'message' => $error->getMessage()], 500);
}

function login(PDO $pdo): void
{
    $username = trim((string)($_POST['username'] ?? ''));
    $password = (string)($_POST['password'] ?? '');

    $stmt = $pdo->prepare('SELECT * FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !hash_equals($user['password_hash'], hash('sha256', $password))) {
        respond(['ok' => false, 'message' => 'اسم المستخدم أو كلمة المرور غير صحيحة'], 401);
    }

    if ((int)$user['is_active'] !== 1) {
        respond(['ok' => false, 'message' => 'هذا الحساب مغلق من الأدمن'], 403);
    }

    $_SESSION['user_id'] = (int)$user['id'];
    respond(['ok' => true, 'user' => publicUser($pdo, $user)]);
}

function logout(): void
{
    $_SESSION = [];
    session_destroy();
    respond(['ok' => true]);
}

function me(PDO $pdo): void
{
    $user = currentUser($pdo, false);
    respond(['ok' => true, 'user' => $user ? publicUser($pdo, $user) : null]);
}

function data(PDO $pdo): void
{
    $user = currentUser($pdo);
    if ($user['role'] === 'resident') {
        respond([
            'ok' => true,
            'user' => publicUser($pdo, $user),
            'apartments' => residentApartments($pdo, $user),
            'payments' => residentPayments($pdo, $user),
            'expenses' => expenses($pdo),
            'sharedCharges' => sharedCharges($pdo),
            'monthlyFee' => MONTHLY_FEE,
        ]);
    }

    respond([
        'ok' => true,
        'user' => publicUser($pdo, $user),
        'apartments' => apartments($pdo),
        'payments' => payments($pdo),
        'expenses' => expenses($pdo),
        'sharedCharges' => sharedCharges($pdo),
        'monthlyFee' => MONTHLY_FEE,
    ]);
}

function ensureSchema(PDO $pdo): void
{
    if (!columnExists($pdo, 'apartments', 'finish_status')) {
        $pdo->exec("
            ALTER TABLE apartments
            ADD COLUMN finish_status ENUM('finished', 'unfinished') NOT NULL DEFAULT 'finished' AFTER occupancy
        ");
    }
    if (!columnExists($pdo, 'apartments', 'floor_number')) {
        $pdo->exec("ALTER TABLE apartments ADD COLUMN floor_number INT UNSIGNED NULL AFTER apartment_number");
    }
    if (!columnExists($pdo, 'apartments', 'unit_number')) {
        $pdo->exec("ALTER TABLE apartments ADD COLUMN unit_number INT UNSIGNED NULL AFTER floor_number");
    }
    if (!columnExists($pdo, 'apartments', 'previous_arrears')) {
        $pdo->exec("ALTER TABLE apartments ADD COLUMN previous_arrears DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER finish_status");
    }
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS shared_charges (
          id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(180) NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          charge_month CHAR(7) NOT NULL,
          details TEXT NOT NULL,
          created_by INT UNSIGNED NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_shared_charges_user
            FOREIGN KEY (created_by) REFERENCES users(id)
            ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    seedBuildingDefaults($pdo);
}

function columnExists(PDO $pdo, string $table, string $column): bool
{
    $stmt = $pdo->prepare("SHOW COLUMNS FROM `$table` LIKE ?");
    $stmt->execute([$column]);
    return (bool)$stmt->fetch();
}

function seedBuildingDefaults(PDO $pdo): void
{
    $names = [
        'الأستاذ محمد أحمد', 'الدكتور خالد إبراهيم', 'الأستاذة هالة ثروت', 'الأستاذ أحمد سمير',
        'المهندس محمود علي', 'الأستاذة منى حسن', 'الدكتور سامح فوزي', 'الأستاذة نجلاء يوسف',
        'الأستاذ طارق عبد الله', 'الأستاذة ريم عادل', 'الأستاذ كريم مصطفى', 'الأستاذة ياسمين صلاح',
        'الدكتور عمرو ناصر', 'الأستاذة سارة محمود', 'الأستاذ شريف كمال', 'المهندسة داليا حسين',
        'الأستاذ وائل فتحي', 'الأستاذة إيمان سعيد', 'الدكتور حسام عبد الرحمن', 'الأستاذة مروة جمال',
        'الأستاذ مصطفى رضا', 'الأستاذة نهى إبراهيم', 'الأستاذ رامي نبيل', 'الدكتورة علا فاروق',
        'الأستاذ إيهاب عادل', 'الأستاذة شيماء طه', 'الأستاذ باسم يوسف', 'الأستاذة مي عبد العزيز',
        'الأستاذ هاني سليمان', 'الدكتور وليد منصور', 'الأستاذة غادة كمال', 'الأستاذ عماد حمدي',
        'الأستاذة بسمة علي', 'الأستاذ حسام صبري', 'الأستاذة آية خالد', 'الدكتور ماجد أمين',
        'الأستاذة رانيا فؤاد', 'الأستاذ نادر محمد', 'الأستاذة دعاء جمال', 'الأستاذ تامر عيسى',
        'الأستاذة هبة سمير', 'الأستاذ علاء الدين', 'الأستاذة نسرين عادل', 'الدكتور شادي نبيل',
        'الأستاذة نهال حسن', 'الأستاذ مينا فؤاد', 'الأستاذة إنجي سامي', 'الأستاذ ياسر عبد المجيد',
    ];

    $phones = [
        '01010530199', '01010530200', '01010530201', '01010530202', '01010530203', '01010530204',
        '01010530205', '01010530206', '01010530207', '01010530208', '01010530209', '01010530210',
        '01010530211', '01010530212', '01010530213', '01010530214', '01010530215', '01010530216',
        '01010530217', '01010530218', '01010530219', '01010530220', '01010530221', '01010530222',
        '01010530223', '01010530224', '01010530225', '01010530226', '01010530227', '01010530228',
        '01010530229', '01010530230', '01010530231', '01010530232', '01010530233', '01010530234',
        '01010530235', '01010530236', '01010530237', '01010530238', '01010530239', '01010530240',
        '01010530241', '01010530242', '01010530243', '01010530244', '01010530245', '01010530246',
    ];

    $passwordHash = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92';
    for ($number = 1; $number <= 48; $number++) {
        $username = 'apt' . $number;
        $pdo->prepare("
            INSERT IGNORE INTO users (role, username, password_hash, is_active)
            VALUES ('resident', ?, ?, 1)
        ")->execute([$username, $passwordHash]);

        $userIdStmt = $pdo->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
        $userIdStmt->execute([$username]);
        $userId = (int)$userIdStmt->fetchColumn();
        if (!$userId) continue;

        $floor = intdiv($number - 1, 4) + 1;
        $unit = (($number - 1) % 4) + 1;
        $occupancy = $number <= 10 ? 'tenant' : 'owner';
        $finishStatus = $number <= 21 ? 'finished' : 'unfinished';

        $pdo->prepare('
            INSERT IGNORE INTO apartments
              (apartment_number, floor_number, unit_number, user_id, resident_name, phone, occupancy, finish_status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, "")
        ')->execute([
            $number,
            $floor,
            $unit,
            $userId,
            $names[$number - 1],
            $phones[$number - 1],
            $occupancy,
            $finishStatus,
        ]);

        $pdo->prepare('
            UPDATE apartments
            SET floor_number = COALESCE(floor_number, ?),
                unit_number = COALESCE(unit_number, ?),
                resident_name = IF(resident_name = "" OR resident_name IS NULL, ?, resident_name),
                phone = IF(phone = "" OR phone IS NULL, ?, phone)
            WHERE apartment_number = ?
        ')->execute([$floor, $unit, $names[$number - 1], $phones[$number - 1], $number]);
    }

    $unfinishedCount = (int)$pdo->query("SELECT COUNT(*) FROM apartments WHERE finish_status = 'unfinished'")->fetchColumn();
    if ($unfinishedCount === 0) {
        $pdo->exec("UPDATE apartments SET finish_status = CASE WHEN apartment_number <= 21 THEN 'finished' ELSE 'unfinished' END");
    }

    $tenantCount = (int)$pdo->query("SELECT COUNT(*) FROM apartments WHERE occupancy = 'tenant'")->fetchColumn();
    if ($tenantCount === 0) {
        $pdo->exec("UPDATE apartments SET occupancy = CASE WHEN apartment_number <= 10 THEN 'tenant' ELSE 'owner' END");
    }
}

function saveApartment(PDO $pdo): void
{
    requireAdmin($pdo);
    $apartmentId = (int)($_POST['apartmentId'] ?? 0);
    $username = trim((string)($_POST['username'] ?? ''));
    $password = trim((string)($_POST['password'] ?? ''));
    $isActive = (int)($_POST['isActive'] ?? 1);
    $floorNumber = max(1, (int)($_POST['floorNumber'] ?? 1));
    $unitNumber = max(1, (int)($_POST['unitNumber'] ?? 1));
    $previousArrears = max(0, (float)($_POST['previousArrears'] ?? 0));

    $apartment = apartmentById($pdo, $apartmentId);
    if (!$apartment) respond(['ok' => false, 'message' => 'الشقة غير موجودة'], 404);
    if ($username === '') respond(['ok' => false, 'message' => 'اسم المستخدم مطلوب'], 422);
    ensureUsernameAvailable($pdo, $username, (int)$apartment['user_id']);
    ensureApartmentSlotAvailable($pdo, $floorNumber, $unitNumber, $apartmentId);

    $pdo->beginTransaction();
    $params = [$username, $isActive ? 1 : 0, (int)$apartment['user_id']];
    $sql = 'UPDATE users SET username = ?, is_active = ?';
    if ($password !== '') {
        $sql .= ', password_hash = ?';
        $params = [$username, $isActive ? 1 : 0, hash('sha256', $password), (int)$apartment['user_id']];
    }
    $sql .= ' WHERE id = ?';
    $pdo->prepare($sql)->execute($params);

    $pdo->prepare('
        UPDATE apartments
        SET floor_number = ?, unit_number = ?, resident_name = ?, phone = ?, occupancy = ?, finish_status = ?, previous_arrears = ?, notes = ?
        WHERE id = ?
    ')->execute([
        $floorNumber,
        $unitNumber,
        trim((string)($_POST['residentName'] ?? '')),
        trim((string)($_POST['phone'] ?? '')),
        ($_POST['occupancy'] ?? 'owner') === 'tenant' ? 'tenant' : 'owner',
        ($_POST['finishStatus'] ?? 'finished') === 'unfinished' ? 'unfinished' : 'finished',
        $previousArrears,
        trim((string)($_POST['notes'] ?? '')),
        $apartmentId,
    ]);
    $pdo->commit();
    respond(['ok' => true]);
}

function createApartment(PDO $pdo): void
{
    requireAdmin($pdo);
    $username = trim((string)($_POST['username'] ?? ''));
    $password = trim((string)($_POST['password'] ?? ''));
    $floorNumber = max(1, (int)($_POST['floorNumber'] ?? 1));
    $unitNumber = max(1, (int)($_POST['unitNumber'] ?? 1));
    $previousArrears = max(0, (float)($_POST['previousArrears'] ?? 0));
    $isActive = (int)($_POST['isActive'] ?? 1);

    if ($username === '') respond(['ok' => false, 'message' => 'اسم المستخدم مطلوب'], 422);
    ensureUsernameAvailable($pdo, $username, 0);
    ensureApartmentSlotAvailable($pdo, $floorNumber, $unitNumber, 0);
    if ($password === '') $password = '123456';

    $pdo->beginTransaction();
    $pdo->prepare("
        INSERT INTO users (role, username, password_hash, is_active)
        VALUES ('resident', ?, ?, ?)
    ")->execute([$username, hash('sha256', $password), $isActive ? 1 : 0]);
    $userId = (int)$pdo->lastInsertId();

    $pdo->prepare('
        INSERT INTO apartments
          (apartment_number, floor_number, unit_number, user_id, resident_name, phone, occupancy, finish_status, previous_arrears, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ')->execute([
        nextApartmentNumber($pdo),
        $floorNumber,
        $unitNumber,
        $userId,
        trim((string)($_POST['residentName'] ?? '')),
        trim((string)($_POST['phone'] ?? '')),
        ($_POST['occupancy'] ?? 'owner') === 'tenant' ? 'tenant' : 'owner',
        ($_POST['finishStatus'] ?? 'finished') === 'unfinished' ? 'unfinished' : 'finished',
        $previousArrears,
        trim((string)($_POST['notes'] ?? '')),
    ]);
    $pdo->commit();
    respond(['ok' => true]);
}

function deleteApartment(PDO $pdo): void
{
    requireAdmin($pdo);
    $apartmentId = (int)($_POST['apartmentId'] ?? 0);
    $deletePassword = trim((string)($_POST['deletePassword'] ?? ''));
    if ($deletePassword !== '1993') {
        respond(['ok' => false, 'message' => 'الرقم السري للحذف غير صحيح'], 403);
    }
    $apartment = apartmentById($pdo, $apartmentId);
    if (!$apartment) respond(['ok' => false, 'message' => 'الشقة غير موجودة'], 404);

    $pdo->beginTransaction();
    $pdo->prepare('DELETE FROM apartments WHERE id = ?')->execute([$apartmentId]);
    $pdo->prepare("DELETE FROM users WHERE id = ? AND role = 'resident'")->execute([(int)$apartment['user_id']]);
    $pdo->commit();
    respond(['ok' => true]);
}

function saveAdmin(PDO $pdo): void
{
    $admin = requireAdmin($pdo);
    $username = trim((string)($_POST['username'] ?? ''));
    $password = trim((string)($_POST['password'] ?? ''));
    if ($username === '') respond(['ok' => false, 'message' => 'اسم المستخدم مطلوب'], 422);
    ensureUsernameAvailable($pdo, $username, (int)$admin['id']);

    $params = [$username, (int)$admin['id']];
    $sql = 'UPDATE users SET username = ?';
    if ($password !== '') {
        $sql .= ', password_hash = ?';
        $params = [$username, hash('sha256', $password), (int)$admin['id']];
    }
    $sql .= ' WHERE id = ?';
    $pdo->prepare($sql)->execute($params);
    respond(['ok' => true]);
}

function saveProfile(PDO $pdo): void
{
    $user = currentUser($pdo);
    $username = trim((string)($_POST['username'] ?? ''));
    $password = trim((string)($_POST['password'] ?? ''));
    $residentName = trim((string)($_POST['residentName'] ?? ''));

    if ($username === '') respond(['ok' => false, 'message' => 'اسم المستخدم مطلوب'], 422);
    ensureUsernameAvailable($pdo, $username, (int)$user['id']);

    $params = [$username, (int)$user['id']];
    $sql = 'UPDATE users SET username = ?';
    if ($password !== '') {
        $sql .= ', password_hash = ?';
        $params = [$username, hash('sha256', $password), (int)$user['id']];
    }
    $sql .= ' WHERE id = ?';

    $pdo->beginTransaction();
    $pdo->prepare($sql)->execute($params);

    if ($user['role'] === 'resident') {
        $pdo->prepare('UPDATE apartments SET resident_name = ? WHERE user_id = ?')
            ->execute([$residentName, (int)$user['id']]);
    }

    $pdo->commit();
    respond(['ok' => true]);
}

function toggleUser(PDO $pdo): void
{
    requireAdmin($pdo);
    $userId = (int)($_POST['userId'] ?? 0);
    $isActive = (int)($_POST['isActive'] ?? 1);
    $pdo->prepare("UPDATE users SET is_active = ? WHERE id = ? AND role = 'resident'")
        ->execute([$isActive ? 1 : 0, $userId]);
    respond(['ok' => true]);
}

function savePayment(PDO $pdo): void
{
    $user = currentUser($pdo);
    $apartmentId = (int)($_POST['apartmentId'] ?? 0);
    $amount = (float)$_POST['amount'];
    if ($user['role'] !== 'admin') {
        $ownApartment = apartmentForUser($pdo, (int)$user['id']);
        $apartmentId = (int)$ownApartment['id'];
        $amount = MONTHLY_FEE + sharedChargeShareForMonth($pdo, (string)$_POST['month']);
        if (($ownApartment['finish_status'] ?? 'finished') === 'unfinished') {
            respond(['ok' => false, 'message' => 'هذه الشقة غير مطالبة بسداد الخدمة حاليًا'], 422);
        }
    }

    $receiptPath = uploadFile('receipt', 'receipts');
    $existing = existingPayment($pdo, $apartmentId, (string)$_POST['month']);
    if (!$receiptPath && $existing) $receiptPath = $existing['receipt_path'];

    $pdo->prepare('
        INSERT INTO payments (apartment_id, service_month, amount, paid_to, method, reference_number, paid_at, receipt_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          amount = VALUES(amount),
          paid_to = VALUES(paid_to),
          method = VALUES(method),
          reference_number = VALUES(reference_number),
          paid_at = VALUES(paid_at),
          receipt_path = VALUES(receipt_path)
    ')->execute([
        $apartmentId,
        (string)$_POST['month'],
        $amount,
        trim((string)$_POST['paidTo']),
        normalizeMethod((string)$_POST['method']),
        trim((string)$_POST['reference']),
        (string)$_POST['paidAt'],
        $receiptPath,
    ]);
    respond(['ok' => true]);
}

function deletePayment(PDO $pdo): void
{
    requireAdmin($pdo);
    $pdo->prepare('DELETE FROM payments WHERE id = ?')->execute([(int)($_POST['id'] ?? 0)]);
    respond(['ok' => true]);
}

function saveExpense(PDO $pdo): void
{
    $admin = requireAdmin($pdo);
    $invoicePath = uploadFile('invoice', 'invoices');
    $pdo->prepare('
        INSERT INTO expenses (title, amount, expense_month, spent_at, details, invoice_path, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ')->execute([
        trim((string)$_POST['title']),
        (float)$_POST['amount'],
        (string)$_POST['month'],
        (string)$_POST['spentAt'],
        trim((string)$_POST['details']),
        $invoicePath,
        (int)$admin['id'],
    ]);
    respond(['ok' => true]);
}

function deleteExpense(PDO $pdo): void
{
    requireAdmin($pdo);
    $pdo->prepare('DELETE FROM expenses WHERE id = ?')->execute([(int)($_POST['id'] ?? 0)]);
    respond(['ok' => true]);
}

function saveSharedCharge(PDO $pdo): void
{
    $admin = requireAdmin($pdo);
    $title = trim((string)($_POST['title'] ?? ''));
    $amount = (float)($_POST['amount'] ?? 0);
    $month = (string)($_POST['month'] ?? '');
    $details = trim((string)($_POST['details'] ?? ''));

    if ($title === '') respond(['ok' => false, 'message' => 'اسم المطالبة مطلوب'], 422);
    if ($amount <= 0) respond(['ok' => false, 'message' => 'المبلغ يجب أن يكون أكبر من صفر'], 422);
    if (!preg_match('/^\d{4}-\d{2}$/', $month)) respond(['ok' => false, 'message' => 'شهر المطالبة غير صحيح'], 422);

    $pdo->prepare('
        INSERT INTO shared_charges (title, amount, charge_month, details, created_by)
        VALUES (?, ?, ?, ?, ?)
    ')->execute([$title, $amount, $month, $details, (int)$admin['id']]);
    respond(['ok' => true]);
}

function deleteSharedCharge(PDO $pdo): void
{
    requireAdmin($pdo);
    $pdo->prepare('DELETE FROM shared_charges WHERE id = ?')->execute([(int)($_POST['id'] ?? 0)]);
    respond(['ok' => true]);
}

function apartments(PDO $pdo): array
{
    return $pdo->query('
        SELECT a.id, a.apartment_number AS number, a.floor_number AS floorNumber,
               a.unit_number AS unitNumber, a.user_id AS userId,
               a.resident_name AS residentName, a.phone, a.occupancy,
               a.finish_status AS finishStatus, a.previous_arrears AS previousArrears, a.notes,
               u.username, u.is_active AS isActive
        FROM apartments a
        JOIN users u ON u.id = a.user_id
        ORDER BY a.apartment_number
    ')->fetchAll();
}

function residentApartments(PDO $pdo, array $user): array
{
    $ownApartment = apartmentForUser($pdo, (int)$user['id']);
    $apartments = apartments($pdo);
    return array_map(static function (array $apartment) use ($ownApartment): array {
        $isOwn = (int)$apartment['id'] === (int)$ownApartment['id'];
        return [
            'id' => (int)$apartment['id'],
            'number' => (int)$apartment['number'],
            'floorNumber' => (int)($apartment['floorNumber'] ?: intdiv((int)$apartment['number'] - 1, 4) + 1),
            'unitNumber' => (int)($apartment['unitNumber'] ?: (((int)$apartment['number'] - 1) % 4) + 1),
            'residentName' => $apartment['residentName'],
            'phone' => $apartment['phone'],
            'occupancy' => $isOwn ? $apartment['occupancy'] : 'owner',
            'finishStatus' => $apartment['finishStatus'] ?? 'finished',
            'previousArrears' => $isOwn ? (float)($apartment['previousArrears'] ?? 0) : 0,
            'username' => $isOwn ? $apartment['username'] : '',
            'isActive' => $isOwn ? (int)$apartment['isActive'] : 1,
        ];
    }, $apartments);
}

function payments(PDO $pdo): array
{
    return $pdo->query('
        SELECT id, apartment_id AS apartmentId, service_month AS month, amount,
               paid_to AS paidTo, method, reference_number AS reference,
               paid_at AS paidAt, receipt_path AS receipt
        FROM payments
        ORDER BY paid_at DESC, id DESC
    ')->fetchAll();
}

function residentPayments(PDO $pdo, array $user): array
{
    $ownApartment = apartmentForUser($pdo, (int)$user['id']);
    $stmt = $pdo->prepare('
        SELECT id, apartment_id AS apartmentId, service_month AS month,
               CASE WHEN apartment_id = ? THEN amount ELSE NULL END AS amount,
               CASE WHEN apartment_id = ? THEN paid_to ELSE "" END AS paidTo,
               CASE WHEN apartment_id = ? THEN method ELSE "" END AS method,
               CASE WHEN apartment_id = ? THEN reference_number ELSE "" END AS reference,
               CASE WHEN apartment_id = ? THEN paid_at ELSE NULL END AS paidAt,
               CASE WHEN apartment_id = ? THEN receipt_path ELSE NULL END AS receipt
        FROM payments
        ORDER BY paid_at DESC, id DESC
    ');
    $ownId = (int)$ownApartment['id'];
    $stmt->execute([$ownId, $ownId, $ownId, $ownId, $ownId, $ownId]);
    return $stmt->fetchAll();
}

function expenses(PDO $pdo): array
{
    return $pdo->query('
        SELECT id, title, amount, expense_month AS month, spent_at AS spentAt,
               details, invoice_path AS invoice
        FROM expenses
        ORDER BY spent_at DESC, id DESC
    ')->fetchAll();
}

function sharedCharges(PDO $pdo): array
{
    return $pdo->query('
        SELECT id, title, amount, charge_month AS month, details
        FROM shared_charges
        ORDER BY charge_month DESC, id DESC
    ')->fetchAll();
}

function sharedChargeShareForMonth(PDO $pdo, string $month): float
{
    $chargeableCount = (int)$pdo->query("SELECT COUNT(*) FROM apartments WHERE finish_status = 'finished'")->fetchColumn();
    if ($chargeableCount <= 0) return 0.0;

    $stmt = $pdo->prepare('SELECT COALESCE(SUM(amount), 0) FROM shared_charges WHERE charge_month = ?');
    $stmt->execute([$month]);
    return round((float)$stmt->fetchColumn() / $chargeableCount, 2);
}

function currentUser(PDO $pdo, bool $required = true): ?array
{
    $id = (int)($_SESSION['user_id'] ?? 0);
    if (!$id) {
        if ($required) respond(['ok' => false, 'message' => 'تحتاج تسجيل دخول'], 401);
        return null;
    }
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $user = $stmt->fetch();
    if (!$user || (int)$user['is_active'] !== 1) {
        $_SESSION = [];
        if ($required) respond(['ok' => false, 'message' => 'الحساب غير متاح'], 403);
        return null;
    }
    return $user;
}

function requireAdmin(PDO $pdo): array
{
    $user = currentUser($pdo);
    if ($user['role'] !== 'admin') respond(['ok' => false, 'message' => 'الأدمن فقط'], 403);
    return $user;
}

function publicUser(PDO $pdo, array $user): array
{
    $public = [
        'id' => (int)$user['id'],
        'role' => $user['role'],
        'username' => $user['username'],
        'isActive' => (int)$user['is_active'],
    ];
    if ($user['role'] === 'resident') {
        $apartment = apartmentForUser($pdo, (int)$user['id']);
        $public['apartmentId'] = (int)$apartment['id'];
        $public['apartmentNumber'] = (int)$apartment['apartment_number'];
        $public['floorNumber'] = (int)($apartment['floor_number'] ?: intdiv((int)$apartment['apartment_number'] - 1, 4) + 1);
        $public['unitNumber'] = (int)($apartment['unit_number'] ?: (((int)$apartment['apartment_number'] - 1) % 4) + 1);
        $public['finishStatus'] = $apartment['finish_status'] ?? 'finished';
    }
    return $public;
}

function apartmentForUser(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare('SELECT * FROM apartments WHERE user_id = ? LIMIT 1');
    $stmt->execute([$userId]);
    return $stmt->fetch() ?: [];
}

function apartmentById(PDO $pdo, int $apartmentId): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM apartments WHERE id = ? LIMIT 1');
    $stmt->execute([$apartmentId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function existingPayment(PDO $pdo, int $apartmentId, string $month): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM payments WHERE apartment_id = ? AND service_month = ? LIMIT 1');
    $stmt->execute([$apartmentId, $month]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function ensureUsernameAvailable(PDO $pdo, string $username, int $exceptUserId): void
{
    $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1');
    $stmt->execute([$username, $exceptUserId]);
    if ($stmt->fetch()) respond(['ok' => false, 'message' => 'اسم المستخدم مستخدم بالفعل'], 422);
}

function ensureApartmentSlotAvailable(PDO $pdo, int $floorNumber, int $unitNumber, int $exceptApartmentId): void
{
    $stmt = $pdo->prepare('
        SELECT id FROM apartments
        WHERE floor_number = ? AND unit_number = ? AND id <> ?
        LIMIT 1
    ');
    $stmt->execute([$floorNumber, $unitNumber, $exceptApartmentId]);
    if ($stmt->fetch()) respond(['ok' => false, 'message' => 'هذا الدور ورقم الشقة مستخدمان بالفعل'], 422);
}

function nextApartmentNumber(PDO $pdo): int
{
    return ((int)$pdo->query('SELECT COALESCE(MAX(apartment_number), 0) FROM apartments')->fetchColumn()) + 1;
}

function uploadFile(string $field, string $folder): ?string
{
    if (!isset($_FILES[$field]) || $_FILES[$field]['error'] === UPLOAD_ERR_NO_FILE) return null;
    if ($_FILES[$field]['error'] !== UPLOAD_ERR_OK) respond(['ok' => false, 'message' => 'فشل رفع الملف'], 422);

    $mime = mime_content_type($_FILES[$field]['tmp_name']);
    $allowed = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'application/pdf' => 'pdf',
    ];
    if (!isset($allowed[$mime])) respond(['ok' => false, 'message' => 'مسموح برفع صورة أو ملف PDF فقط'], 422);

    $dir = APP_UPLOAD_DIR . '/' . $folder;
    if (!is_dir($dir)) mkdir($dir, 0755, true);

    $name = bin2hex(random_bytes(12)) . '.' . $allowed[$mime];
    $path = $dir . '/' . $name;
    if (!move_uploaded_file($_FILES[$field]['tmp_name'], $path)) {
        respond(['ok' => false, 'message' => 'تعذر حفظ الملف'], 500);
    }
    return APP_UPLOAD_URL . '/' . $folder . '/' . $name;
}

function normalizeMethod(string $method): string
{
    if (in_array($method, ['wallet', 'instapay', 'cash'], true)) return $method;
    if ($method === 'إنستا باي') return 'instapay';
    if ($method === 'كاش') return 'cash';
    return 'wallet';
}

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}
