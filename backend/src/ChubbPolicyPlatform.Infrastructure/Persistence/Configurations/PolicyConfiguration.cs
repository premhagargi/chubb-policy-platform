using ChubbPolicyPlatform.Domain.Entities;
using ChubbPolicyPlatform.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChubbPolicyPlatform.Infrastructure.Persistence.Configurations;

public class PolicyConfiguration : IEntityTypeConfiguration<Policy>
{
    public void Configure(EntityTypeBuilder<Policy> builder)
    {
        builder.ToTable("Policies");
        builder.HasKey(p => p.Id);

        builder.Property(p => p.PolicyNumber).HasMaxLength(20).IsRequired();
        builder.HasIndex(p => p.PolicyNumber).IsUnique();

        builder.Property(p => p.PolicyholderName).HasMaxLength(200).IsRequired();
        builder.Property(p => p.Underwriter).HasMaxLength(200).IsRequired();

        builder.Property(p => p.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();
        builder.HasIndex(p => p.Status);

        builder.Property(p => p.LineOfBusiness)
            .HasConversion(v => v.ToWireString(), v => LineOfBusinessExtensions.FromWireString(v))
            .HasMaxLength(20)
            .IsRequired();
        builder.HasIndex(p => p.LineOfBusiness);

        builder.Property(p => p.Region)
            .HasConversion(v => v.ToWireString(), v => RegionExtensions.FromWireString(v))
            .HasMaxLength(20)
            .IsRequired();
        builder.HasIndex(p => p.Region);

        builder.Property(p => p.Currency)
            .HasConversion<string>()
            .HasMaxLength(3)
            .IsRequired();

        builder.Property(p => p.PremiumAmount).HasColumnType("decimal(18,2)");

        builder.Property(p => p.EffectiveDate).HasColumnType("date");
        builder.Property(p => p.ExpiryDate).HasColumnType("date");
        builder.HasIndex(p => new { p.EffectiveDate, p.ExpiryDate });

        builder.Property(p => p.FlaggedForReview).HasDefaultValue(false);

        builder.Property(p => p.CreatedAt);
        builder.Property(p => p.UpdatedAt);
    }
}
