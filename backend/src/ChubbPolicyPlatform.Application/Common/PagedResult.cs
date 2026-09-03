namespace ChubbPolicyPlatform.Application.Common;

public class PagedResult<T>
{
    public required IReadOnlyList<T> Items { get; init; }
    public required int Page { get; init; }
    public required int Size { get; init; }
    public required int TotalCount { get; init; }
    public int TotalPages => Size == 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)Size);
}
