using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChubbPolicyPlatform.Infrastructure.Persistence.Migrations;

/// <summary>
/// Hand-written (no `dotnet` SDK was available to generate this via `dotnet ef
/// migrations add`) — see ../Migrations/README.md. Up/Down match PolicyConfiguration
/// exactly and are sufficient for `Database.Migrate()` at runtime, which only needs the
/// Migration classes themselves, not a ModelSnapshot. The ModelSnapshot/Designer files
/// were deliberately NOT hand-fabricated here — they're only needed by the `dotnet ef
/// migrations add` design-time diff tool to generate the *next* migration, not to apply
/// this one, and hand-authoring their exact EF Core/Npgsql annotation format correctly
/// (without a compiler to check it) was judged too risky to be worth it.
/// </summary>
[Migration("20260903000001_InitialCreate")]
public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "Policies",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                PolicyNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                PolicyholderName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                LineOfBusiness = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                PremiumAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                Currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                EffectiveDate = table.Column<DateOnly>(type: "date", nullable: false),
                ExpiryDate = table.Column<DateOnly>(type: "date", nullable: false),
                Region = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                Underwriter = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                FlaggedForReview = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Policies", x => x.Id);
            });

        migrationBuilder.CreateIndex(
            name: "IX_Policies_PolicyNumber",
            table: "Policies",
            column: "PolicyNumber",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_Policies_Status",
            table: "Policies",
            column: "Status");

        migrationBuilder.CreateIndex(
            name: "IX_Policies_LineOfBusiness",
            table: "Policies",
            column: "LineOfBusiness");

        migrationBuilder.CreateIndex(
            name: "IX_Policies_Region",
            table: "Policies",
            column: "Region");

        migrationBuilder.CreateIndex(
            name: "IX_Policies_EffectiveDate_ExpiryDate",
            table: "Policies",
            columns: new[] { "EffectiveDate", "ExpiryDate" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "Policies");
    }
}
