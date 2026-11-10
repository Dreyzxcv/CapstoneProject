<?php

namespace Tests\Feature;

use App\Enums\AssetMode;
use App\Enums\AssetStatus;
use App\Enums\AssetType;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Models\Asset;
use App\Models\AssetCaseStatusHistory;
use App\Models\Document;
use App\Models\Notification;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Illuminate\Support\Str;

class DocumentRejectionReturnsToMesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function makeAsset(array $overrides = []): Asset
    {
        // Any mode except TurnedOver requires DAO/Tally/Seizure/AAP.
        $mode = collect(AssetMode::cases())
            ->first(fn ($m) => $m !== AssetMode::TurnedOver);

        return Asset::create(array_merge([
            'asset_code'             => 'AST-TEST-0001',
            'item_number'            => 1,
            'type'                   => AssetType::from('log'),
            'mode'                   => $mode,
            'quantity'               => 1,
            'current_status'         => AssetStatus::PendingCustodyReview,
            'custody_review_status'  => 'pending',
            'municipality_of_origin' => 'Virac',
            'location_apprehended'   => 'Virac',
            'apprehending_agency'    => 'PENRO',
            'qr_code_token'          => (string) Str::uuid(), // NOT NULL, likely unique per row
        ], $overrides));
    }

    private function pendingReviewAssets(): array
    {
        $mes = User::factory()->create();
        $mes->assignRole('MES Officer');

        $custodian = User::factory()->create();
        $custodian->assignRole('Property Custodian');

        $shared = [
            'custody_review_submitted_by' => $mes->id,
            'created_by'                  => $mes->id,
        ];

        $primary = $this->makeAsset($shared + ['item_number' => 1]);
        $sibling = $this->makeAsset($shared + ['item_number' => 2]);

        return [$primary, $sibling, $mes, $custodian];
    }

    private function docFor(Asset $asset, DocumentType $type, string $path = 'documents/required/x.pdf'): Document
    {
        return Document::create([
            'attachable_type' => Asset::class,
            'attachable_id'   => $asset->id,
            'document_type'   => $type,
            'file_path'       => $path,
            'original_name'   => basename($path),
            'mime_type'       => 'application/pdf',
            'status'          => DocumentStatus::Pending,
            'uploaded_by'     => $asset->custody_review_submitted_by,
            'uploaded_at'     => now(),
        ]);
    }

    public function test_rejecting_required_document_returns_asset_and_siblings_with_same_remarks(): void
    {
        [$primary, $sibling, $mes, $custodian] = $this->pendingReviewAssets();
        $doc = $this->docFor($primary, DocumentType::DaoForm);
        $this->docFor($sibling, DocumentType::DaoForm);

        $this->actingAs($custodian)
            ->post(route('documents.verify', $doc), [
                'decision' => 'rejected',
                'remarks' => 'Signature missing on page 2.',
            ])->assertRedirect();

        foreach ([$primary, $sibling] as $a) {
            $a->refresh();
            $this->assertSame(AssetStatus::DocumentsUploaded, $a->current_status);
            $this->assertSame('returned', $a->custody_review_status);
            $this->assertSame('Signature missing on page 2.', $a->custody_review_remarks);
        }

        $history = AssetCaseStatusHistory::where('asset_id', $primary->id)
            ->where('notes', 'like', '%returned for revision%')->get();
        $this->assertCount(1, $history);
        $this->assertStringContainsString('Signature missing on page 2.', $history->first()->notes);

        $this->assertSame(1, Notification::where('user_id', $mes->id)
            ->where('asset_id', $primary->id)
            ->count());
    }

    public function test_second_rejection_does_not_duplicate_history_or_notification(): void
    {
        [$primary, , $mes, $custodian] = $this->pendingReviewAssets();
        $a = $this->docFor($primary, DocumentType::DaoForm, 'documents/required/a.pdf');
        $b = $this->docFor($primary, DocumentType::TallySheet, 'documents/required/b.pdf');

        $this->actingAs($custodian)->post(route('documents.verify', $a), ['decision' => 'rejected', 'remarks' => 'First.']);
        $this->actingAs($custodian)->post(route('documents.verify', $b), ['decision' => 'rejected', 'remarks' => 'Second.']);

        $this->assertSame(1, AssetCaseStatusHistory::where('asset_id', $primary->id)
            ->where('notes', 'like', '%returned for revision%')->count());
        $this->assertSame(1, Notification::where('user_id', $mes->id)
            ->where('asset_id', $primary->id)
            ->count());
        $this->assertSame('First.', $primary->refresh()->custody_review_remarks);
    }

    public function test_rejection_requires_remarks_and_authorization(): void
    {
        [$primary, , $mes, $custodian] = $this->pendingReviewAssets();
        $doc = $this->docFor($primary, DocumentType::DaoForm);

        $this->actingAs($custodian)
            ->post(route('documents.verify', $doc), ['decision' => 'rejected'])
            ->assertSessionHasErrors('remarks');

        $this->actingAs($mes)
            ->post(route('documents.verify', $doc), ['decision' => 'rejected', 'remarks' => 'x'])
            ->assertForbidden();

        $this->assertSame('pending', $primary->refresh()->custody_review_status);
    }

    public function test_verified_documents_still_require_custodian_approval(): void
    {
        [$primary, $sibling, , $custodian] = $this->pendingReviewAssets();
        $doc = $this->docFor($primary, DocumentType::DaoForm);

        $this->actingAs($custodian)
            ->post(route('documents.verify', $doc), ['decision' => 'verified'])
            ->assertRedirect();

        // Verification alone does not approve or return the review.
        $primary->refresh();
        $this->assertSame(AssetStatus::PendingCustodyReview, $primary->current_status);
        $this->assertSame('pending', $primary->custody_review_status);

        $this->actingAs($custodian)
            ->post(route('assets.resolve-custody-review', $primary), ['decision' => 'approved'])
            ->assertRedirect();

        $this->assertSame('approved', $primary->refresh()->custody_review_status);
        $this->assertSame('approved', $sibling->refresh()->custody_review_status);
    }
}